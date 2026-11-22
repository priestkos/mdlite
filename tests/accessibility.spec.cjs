const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let app, page, profile;
test.beforeEach(async () => {
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlite-accessible-'));
  app = await electron.launch({ executablePath: process.env.MDLITE_EXECUTABLE_PATH || undefined,
    args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...(process.env.MDLITE_EXECUTABLE_PATH ? [] : [path.resolve(__dirname, '..')])],
    env: { ...process.env, MDLITE_TEST_USER_DATA: profile } });
  page = await app.firstWindow();
  await expect(page.locator('.ProseMirror')).toBeVisible();
});
test.afterEach(async () => {
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(w => w.destroy()));
  await app.close();
  await fs.rm(profile, {recursive:true, force:true, maxRetries:5, retryDelay:300});
});

test('large readable type, low-glare surfaces, AA text contrast and clear keyboard focus', async () => {
  const measurements = await page.evaluate(() => {
    const style = selector => getComputedStyle(document.querySelector(selector));
    const rgb = value => value.match(/[\d.]+/g).slice(0,3).map(Number);
    const luminance = color => rgb(color).map(v => { v/=255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const contrast = (fg,bg) => { const a=luminance(fg),b=luminance(bg); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); };
    const pairs=[['.ProseMirror','.page'],['.outline-item','.sidebar'],['.file-detail','.sidebar'],['.eyebrow','.sidebar'],['.statusbar','.statusbar'],['.toolbar button','.toolbar'],['.modes button.selected','.modes button.selected'],['.page-kicker','.page']];
    return {
      body:parseFloat(style('.ProseMirror').fontSize), source:parseFloat(style('#source').fontSize),
      labels:['.file-actions button','.toolbar button','.outline-item','.statusbar','.modes button'].map(s=>parseFloat(style(s).fontSize)),
      controls:[...document.querySelectorAll('.file-actions button,.toolbar button,.modes button,#typography')].map(el=>el.getBoundingClientRect().height),
      contrasts:pairs.map(([a,b])=>({selector:a,ratio:contrast(style(a).color,style(b).backgroundColor)})),
      paper:style('.page').backgroundColor,
    };
  });
  expect(measurements.body).toBeGreaterThanOrEqual(20);
  expect(measurements.source).toBeGreaterThanOrEqual(20);
  for (const size of measurements.labels) expect(size).toBeGreaterThanOrEqual(16);
  for (const height of measurements.controls) expect(height).toBeGreaterThanOrEqual(44);
  for (const item of measurements.contrasts) expect(item.ratio,item.selector).toBeGreaterThanOrEqual(4.5);
  expect(measurements.paper).not.toBe('rgb(255, 255, 255)');
  await page.keyboard.press('Tab');
  const focus=await page.evaluate(()=>({width:parseFloat(getComputedStyle(document.activeElement).outlineWidth),style:getComputedStyle(document.activeElement).outlineStyle}));
  expect(focus.width).toBeGreaterThanOrEqual(3);
  expect(focus.style).toBe('solid');
});

for (const [width,height] of [[1180,800],[760,540]]) {
  test(`labelled controls remain reachable at ${width}x${height}`,async()=>{
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
    await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([width,height]);
    const layout=await page.evaluate(()=>({
      width:innerWidth, scroll:document.documentElement.scrollWidth,
      buttons:[...document.querySelectorAll('.file-actions button,.toolbar button,.modes button')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom};}),
      canvas:document.querySelector('.canvas').getBoundingClientRect().height,
      labels:[...document.querySelectorAll('.toolbar button span')].every(el=>getComputedStyle(el).display!=='none'),
    }));
    expect(layout.scroll).toBeLessThanOrEqual(layout.width);
    expect(layout.canvas).toBeGreaterThan(100);
    expect(layout.labels).toBe(true);
    for(const button of layout.buttons){expect(button.left,button.text).toBeGreaterThanOrEqual(0);expect(button.right,button.text).toBeLessThanOrEqual(width);expect(button.bottom,button.text).toBeLessThanOrEqual(height);}
    await fs.mkdir(path.resolve('evidence/accessibility'),{recursive:true});
    await page.screenshot({path:path.resolve(`evidence/accessibility/editor-${width}.png`)});
  });
}
