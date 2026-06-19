/* eslint-env node */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, describe, it } = require('node:test');
const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const siteUrl = 'https://jephthatandri.dev/';
const windows = ['about', 'cekopi', 'cakequest', 'skybattle', 'lakewater', 'stairs'];

const projectLinks = [
  'https://github.com/Jephtha-T/EspExAnalyser',
  'https://drive.google.com/file/d/1G2eDrqKYsEG2PgP1s3cj7EkXHyOeBs7u/view?usp=drive_link',
  'https://github.com/Jephtha-T/CakeQuest',
  'https://github.com/Jephtha-T/DMS_CW2024',
  'https://github.com/Abdullah-Usmani/sat-water-temps/tree/Abdullah',
  'https://sat-water-temps.pages.dev/',
  'https://jephtha-t.github.io/Stairs/',
];

const socialLinks = [
  'https://open.spotify.com/user/k9gaming909?si=69a5829d47234a96',
  'https://wa.me/6285284170407',
  'https://www.instagram.com/jejephtha/',
  'https://www.linkedin.com/in/jephtha-at/',
  'https://github.com/Jephtha-T',
];

const contactLink = 'https://mail.google.com/mail/?view=cm&fs=1&to=jephtha909@gmail.com';

const findChromeDriver = () => {
  if (process.env.CHROMEDRIVER_PATH) return process.env.CHROMEDRIVER_PATH;

  const cacheRoot = path.join(os.homedir(), '.cache', 'selenium', 'chromedriver');
  const driverName = process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
  const matches = [];

  const search = (directory) => {
    if (!fs.existsSync(directory)) return;

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) search(entryPath);
      if (entry.name === driverName) matches.push(entryPath);
    }
  };

  search(cacheRoot);
  return matches.at(-1);
};

const buildDriver = () => {
  const options = new chrome.Options().addArguments(
    '--headless=new',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-sandbox'
  );

  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  const driverPath = findChromeDriver();
  if (driverPath) builder.setChromeService(new chrome.ServiceBuilder(driverPath));

  return builder.build();
};

describe('portfolio live site', () => {
  let driver;

  const loadSite = async (width = 1366, height = 900) => {
    await driver.manage().window().setRect({ width, height });
    await driver.get(siteUrl);
    await driver.wait(
      () => driver.executeScript("return document.body.classList.contains('is-ready')"),
      5000
    );
  };

  const click = async (selector) => {
    const element = await driver.findElement(By.css(selector));
    await driver.executeScript('arguments[0].click()', element);
  };

  const isOpen = (id) =>
    driver.executeScript(
      `return document.querySelector('.window--floating[data-window="' + arguments[0] + '"]')
        .classList.contains('is-open');`,
      id
    );

  const openWindow = async (id) => {
    await click(`[data-open="${id}"]`);
    await driver.wait(() => isOpen(id), 2000);
  };

  const hrefs = (selector) =>
    driver.executeScript(
      'return [...document.querySelectorAll(arguments[0])].map((link) => link.href);',
      selector
    );

  const openWindowCount = () =>
    driver.executeScript("return document.querySelectorAll('.window--floating.is-open').length;");

  before(async () => {
    driver = await buildDriver();
  });

  beforeEach(async () => {
    await loadSite();
  });

  after(async () => {
    if (driver) await driver.quit();
  });

  it('opens every desktop icon window', async () => {
    for (const id of windows) {
      await openWindow(id);
      assert.equal(await isOpen(id), true);
    }
  });

  it('opens the about me window from the about me icon', async () => {
    await click('.hero-actions button[data-open="about"]');
    assert.equal(await isOpen('about'), true);
  });

  it('has the right project button links', async () => {
    assert.deepEqual(await hrefs('.project-buttons a'), projectLinks);
  });

  it('has the right contact link', async () => {
    assert.deepEqual(await hrefs('.hero-actions a.desktop-icon'), [contactLink]);
  });

  it('has the right taskbar social links', async () => {
    assert.deepEqual(await hrefs('.taskbar-apps a'), socialLinks);
  });

  it('closes each window with its close button', async () => {
    for (const id of windows) {
      await openWindow(id);
      await click(`.window--floating[data-window="${id}"] .window__close`);
      assert.equal(await isOpen(id), false);
    }
  });

  it('closes all open windows with the taskbar logo', async () => {
    await openWindow('about');
    await openWindow('cekopi');
    assert.equal(await openWindowCount(), 2);

    await click('.taskbar-logo');
    assert.equal(await openWindowCount(), 0);
  });

  it('keeps windows inside desktop and mobile screens', async () => {
    for (const size of [
      { width: 1366, height: 900 },
      { width: 375, height: 667 },
    ]) {
      await loadSite(size.width, size.height);

      for (const id of windows) {
        await openWindow(id);

        const rect = await driver.executeScript(
          `
            const box = document
              .querySelector('.window--floating[data-window="' + arguments[0] + '"]')
              .getBoundingClientRect();

            return {
              top: box.top,
              right: box.right,
              bottom: box.bottom,
              left: box.left,
              width: box.width,
              height: box.height,
              viewportWidth: window.innerWidth,
              viewportHeight: window.innerHeight,
            };
          `,
          id
        );

        assert.ok(rect.width > 0, `${id} should have width`);
        assert.ok(rect.height > 0, `${id} should have height`);
        assert.ok(rect.left >= -1, `${id} should not overflow left`);
        assert.ok(rect.top >= -1, `${id} should not overflow top`);
        assert.ok(rect.right <= rect.viewportWidth + 1, `${id} should not overflow right`);
        assert.ok(rect.bottom <= rect.viewportHeight + 1, `${id} should not overflow bottom`);
      }
    }
  });

  it('scrolls section dots to their sections', async () => {
    for (const id of windows) {
      await openWindow(id);

      const dots = await driver.findElements(
        By.css(`.window--floating[data-window="${id}"] [data-scroll-target]`)
      );

      for (const dot of dots) {
        await driver.executeScript('arguments[0].click()', dot);
        await driver.wait(async () => {
          const distance = await driver.executeScript(
            `
              const dot = arguments[0];
              const section = document.getElementById(dot.dataset.scrollTarget);
              const scroller = section.closest('.project-scroll');
              const targetTop =
                section.getBoundingClientRect().top -
                scroller.getBoundingClientRect().top +
                scroller.scrollTop;
              const maxTop = scroller.scrollHeight - scroller.clientHeight;
              const expectedTop = Math.max(0, Math.min(maxTop, targetTop));

              return Math.abs(scroller.scrollTop - expectedTop);
            `,
            dot
          );

          return distance < 4;
        }, 2000);
      }
    }
  });
});
