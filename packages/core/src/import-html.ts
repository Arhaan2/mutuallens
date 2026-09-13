import { Parser } from 'htmlparser2';
import type { Direction } from './types';
import { normalizeUsername } from './identity';

export interface HtmlList {
  direction?: Direction;
  rows: unknown[];
}
interface Frame {
  tag: string;
  text: string;
  excluded: boolean;
  direction?: Direction;
  container: boolean;
  recordContainer: boolean;
  explicit: boolean;
}
function headingDirection(value: string): Direction | undefined {
  const text = value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (/^(?:your |instagram )?followers?$/.test(text)) return 'followers';
  if (
    /^(?:your |instagram )?following$/.test(text) ||
    text === 'accounts you follow'
  )
    return 'following';
  return undefined;
}
const excludedHeading = (value: string) =>
  /\b(?:blocked|pending|requests?|close friends|recently unfollowed|restricted|favorites|favourites|messages|likes|comments|suggested)\b/i.test(
    value,
  );
/** Event parser only: no DOM, resource loaders, navigation, eval, or script execution. */
export function parseRelationshipHtml(
  text: string,
  hint?: Direction,
): HtmlList[] {
  const stack: Frame[] = [];
  const groups = new Map<Direction | 'ambiguous', unknown[]>();
  let section: Direction | undefined = hint;
  let excludedSection = false;
  let recognized = false;
  let sawContainer = false;
  let sectionHeading = false;
  let titleDirection: Direction | undefined;
  let anchor:
    | { href: string; text: string; direction?: Direction; allowed: boolean }
    | undefined;
  const ensure = (direction?: Direction) => {
    const key = direction ?? 'ambiguous';
    let values = groups.get(key);
    if (!values) {
      values = [];
      groups.set(key, values);
    }
    return values;
  };
  const parser = new Parser(
    {
      onopentag(tag, attributes) {
        if (stack.length > 256)
          throw new Error(
            'The HTML nesting exceeds safe parsing limits. Select the relationship files directly.',
          );
        const parent = stack.at(-1);
        const descriptor = [
          attributes.id,
          attributes['data-title'],
          attributes['aria-label'],
        ]
          .filter(Boolean)
          .join(' ');
        const local = [
          attributes.id,
          attributes['data-title'],
          attributes['aria-label'],
        ]
          .map((value) => headingDirection(value ?? ''))
          .find(Boolean);
        const excluded =
          !!parent?.excluded ||
          [
            'script',
            'style',
            'template',
            'noscript',
            'nav',
            'header',
            'footer',
            'aside',
          ].includes(tag) ||
          excludedHeading(descriptor);
        const container = [
          'main',
          'article',
          'section',
          'div',
          'ul',
          'ol',
          'table',
        ].includes(tag);
        const direction = local ?? parent?.direction;
        const recordContainer =
          !!parent?.recordContainer ||
          ['li', 'tr'].includes(tag) ||
          /(?:^|\s)(?:_a6-p|_a6-g|relationship-record|account-entry|profile-row)(?:\s|$)/.test(
            attributes.class ?? '',
          );
        const explicit = !!local || !!parent?.explicit;
        stack.push({
          tag,
          text: '',
          excluded,
          direction,
          container,
          recordContainer,
          explicit,
        });
        if (local && !excluded) {
          recognized = true;
          section = local;
          excludedSection = false;
          ensure(local);
        }
        if (
          !excluded &&
          (recordContainer || explicit || ['ul', 'ol', 'table'].includes(tag))
        ) {
          sawContainer = true;
          ensure(direction ?? section ?? titleDirection);
        }
        if (tag === 'a')
          anchor = {
            href: attributes.href ?? '',
            text: '',
            direction: direction ?? section ?? titleDirection,
            allowed:
              !excluded &&
              !excludedSection &&
              (recordContainer ||
                explicit ||
                (sectionHeading &&
                  ['body', 'main', 'article', 'section', 'div'].includes(
                    parent?.tag ?? '',
                  ))),
          };
      },
      ontext(value) {
        const current = stack.at(-1);
        if (
          !current?.excluded &&
          current &&
          ['title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(current.tag) &&
          current.text.length < 512
        )
          current.text += value.slice(0, 512 - current.text.length);
        if (anchor && anchor.text.length < 2048)
          anchor.text += value.slice(0, 2048 - anchor.text.length);
      },
      onclosetag(tag) {
        const current = stack.pop();
        if (!current) return;
        if (
          ['title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag) &&
          !current.excluded
        ) {
          const label = current.text.trim();
          const found = headingDirection(label);
          if (tag === 'title') {
            if (found) {
              titleDirection = found;
              recognized = true;
              ensure(found);
            }
          } else {
            excludedSection = excludedHeading(label);
            if (found) {
              section = found;
              sectionHeading = true;
              recognized = true;
              ensure(found);
              const container = [...stack]
                .reverse()
                .find((frame) => frame.container);
              if (container) container.direction = found;
            } else if (excludedSection) section = undefined;
          }
        }
        if (tag === 'a' && anchor) {
          const candidate = anchor;
          anchor = undefined;
          if (!candidate.allowed) return;
          const parent = stack.at(-1);
          const direction = parent?.direction ?? candidate.direction;
          const label = candidate.text.trim();
          // Export navigation links and linked headings are not relationship records.
          if (
            headingDirection(label) ||
            excludedHeading(label) ||
            !candidate.href
          )
            return;
          let username: string | undefined;
          try {
            username = normalizeUsername(candidate.href);
          } catch {
            /* Invalid identity is counted by the row parser, never followed. */
          }
          // Unknown documents require genuine account links before assignment is offered.
          sawContainer = true;
          ensure(direction).push({
            string_list_data: [
              {
                href: candidate.href,
                ...(label && /^@?[A-Za-z0-9._]{1,30}$/.test(label)
                  ? { value: label }
                  : username
                    ? { value: username }
                    : {}),
              },
            ],
          });
        }
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
      recognizeSelfClosing: true,
    },
  );
  parser.end(text);
  if (!recognized && hint && !groups.size)
    throw new Error(
      'This HTML file has no recognized relationship container or profile records. Select the Instagram followers/following HTML files.',
    );
  if (!sawContainer || !groups.size)
    throw new Error(
      'This HTML file has no recognized followers/following content. Select the relationship HTML files rather than an export index.',
    );
  return [...groups].map(([key, values]) => ({
    ...(key === 'ambiguous' ? {} : { direction: key }),
    rows: values,
  }));
}
