import assert from 'node:assert/strict'
import { isLineInAppBrowser } from './lineInAppBrowser'

const lineIosUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.10.0'
const lineAndroidUserAgent =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 Line/14.11.1'
const iphoneSafariUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const androidChromeUserAgent =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
const desktopChromeUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

assert.equal(isLineInAppBrowser(lineIosUserAgent), true)
assert.equal(isLineInAppBrowser(lineAndroidUserAgent), true)
assert.equal(isLineInAppBrowser(lineIosUserAgent.replace('Line/', 'lInE/')), true)
assert.equal(isLineInAppBrowser(iphoneSafariUserAgent), false)
assert.equal(isLineInAppBrowser(androidChromeUserAgent), false)
assert.equal(isLineInAppBrowser(desktopChromeUserAgent), false)
assert.equal(isLineInAppBrowser(''), false)
assert.equal(isLineInAppBrowser(null), false)
assert.equal(isLineInAppBrowser(undefined), false)

console.log('✓ LINE in-app browser user agent checks passed')
