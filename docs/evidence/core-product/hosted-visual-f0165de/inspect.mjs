/* global document, innerWidth, window -- evaluated in the isolated browser page context. */
import { Buffer } from 'node:buffer';
import { chromium, expect } from '/Users/arhaan/Documents/ChatGPT/mutuallens/node_modules/@playwright/test/index.mjs';
import AxeBuilder from '/Users/arhaan/Documents/ChatGPT/mutuallens/node_modules/@axe-core/playwright/dist/index.mjs';
import { writeFile } from 'node:fs/promises';
const root='/tmp/mutuallens-core-product/evidence/hosted-final';
const site='https://codex-ui-functional-repair.mutuallens-ddm.pages.dev';
const checker='https://codex-ui-functional-repair.mutuallens-app.pages.dev';
const expectedCommit='f0165de28d71180f9018eed8c1bd30633bfd6415';
const expectedSource='ffbc199edb1b72999beae53778e41f8b9f29b50d2652d6d82bd14df18643b1e1';
const browser=await chromium.launch();
const evidence={testedAt:new Date().toISOString(),browser:'Chromium',version:browser.version(),viewport:{width:390,height:844},provenance:[],pages:[],errors:[],badResponses:[],externalRequests:[],nonReadRequests:[]};
try {
 const context=await browser.newContext({viewport:evidence.viewport});
 const page=await context.newPage();
 page.on('pageerror',error=>evidence.errors.push(error.message));
 page.on('console',event=>{if(event.type()==='error') evidence.errors.push(event.text())});
 page.on('request',r=>{if(![site,checker].includes(new URL(r.url()).origin)) evidence.externalRequests.push(r.url());if(!['GET','HEAD'].includes(r.method())) evidence.nonReadRequests.push({method:r.method(),url:r.url()})});
 page.on('response',r=>{if(r.status()>=400)evidence.badResponses.push({url:r.url(),status:r.status()})});
 for(const origin of [site,checker]){
  const response=await page.request.get(`${origin}/build-info.json`,{headers:{'Cache-Control':'no-cache'}});
  const info=await response.json();
  expect(response.status()).toBe(200);expect(info.commit).toBe(expectedCommit);expect(info.sourceHash).toBe(expectedSource);
  evidence.provenance.push({url:response.url(),status:response.status(),...info});
 }
 await page.goto(site);
 await page.screenshot({path:`${root}/public-390.png`});
 evidence.pages.push({url:page.url(),state:'public entry',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),axe:(await new AxeBuilder({page}).analyze()).violations});
 await page.goto(checker);
 await page.locator('#import-files').waitFor({state:'visible'});
 const buttons=page.locator('main > .inline-actions > button');
 await expect(buttons).toHaveCount(2);
 const first=await buttons.nth(0).boundingBox(), second=await buttons.nth(1).boundingBox();
 const gap=second.x-(first.x+first.width);
 expect(gap).toBeGreaterThanOrEqual(10);
 await page.screenshot({path:`${root}/checker-entry-390.png`});
 evidence.pages.push({url:page.url(),state:'checker entry',buttonHorizontalGap:gap,firstButton:first,secondButton:second,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),axe:(await new AxeBuilder({page}).analyze()).violations});
 const row=value=>({string_list_data:[{value}]});
 const names=start=>Array.from({length:6000},(_,i)=>`mobile_fixture_${String(start+i+1).padStart(5,'0')}`);
 const files=[{name:'followers_1.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(names(0).map(row)))},{name:'following.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({relationships_following:names(1500).map(row)}))}];
 await page.locator('#import-files').setInputFiles(files);
 await page.getByRole('button',{name:/Compare local files/}).click();
 await expect(page.locator('#results-title')).toHaveText('Your uploaded files');
 await expect(page.locator('.category.active')).toHaveAccessibleName('Not following you back 1,500');
 await expect(page.getByRole('button',{name:'Mutuals 4,500',exact:true})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`${root}/checker-results-top-390.png`});
 await page.locator('.list-caption').evaluate(element=>window.scrollTo(0,window.scrollY+element.getBoundingClientRect().top-190));
 await page.screenshot({path:`${root}/checker-results-list-390.png`});
 evidence.pages.push({url:page.url(),state:'real uploaded synthetic6000x6000 results',followers:6000,following:6000,mutuals:4500,nonfollowers:1500,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),axe:(await new AxeBuilder({page}).analyze()).violations});
 for(const item of evidence.pages){expect(item.overflow).toBe(false);expect(item.axe).toEqual([])}
 expect(evidence.errors).toEqual([]);expect(evidence.badResponses).toEqual([]);expect(evidence.externalRequests).toEqual([]);expect(evidence.nonReadRequests).toEqual([]);
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`${root}/checker-results-top-1440.png`});
 await page.locator('.list-caption').evaluate(element=>window.scrollTo(0,window.scrollY+element.getBoundingClientRect().top-190));
 await page.screenshot({path:`${root}/checker-results-list-1440.png`});
 const simulatedTarget='https://www.instagram.com/mobile_fixture_06001/';
 const intercepted=[];
 await context.route('https://www.instagram.com/**',async route=>{
  intercepted.push({url:route.request().url(),method:route.request().method(),fulfilledLocally:true});
  await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="en"><head><title>Simulated profile destination</title><meta name="referrer" content="no-referrer"></head><body><h1>Simulated destination only</h1></body></html>'});
 });
 const profile=page.locator('.account-list a').first();
 await expect(profile).toHaveAttribute('href',simulatedTarget);
 const popupEvent=context.waitForEvent('page');
 await profile.click();
 const popup=await popupEvent;
 await popup.waitForLoadState('domcontentloaded');
 const isolation=await popup.evaluate(()=>({openerIsNull:window.opener===null,referrer:document.referrer,title:document.title}));
 expect(popup.url()).toBe(simulatedTarget);expect(isolation.openerIsNull).toBe(true);expect(isolation.referrer).toBe('');
 expect(intercepted.some(item=>item.url===simulatedTarget)).toBe(true);
 evidence.simulatedProfileNavigation={actualWebsiteSource:page.url(),target:popup.url(),destination:'Playwright route fulfillment; no real Instagram destination response',intercepted,...isolation};
 await popup.close();
 await page.getByRole('button',{name:'Start over',exact:true}).click();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`${root}/checker-entry-1440.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
} finally {
 await writeFile(`${root}/inspection.json`,JSON.stringify(evidence,null,2));
 await browser.close();
}
console.log(JSON.stringify(evidence,null,2));
