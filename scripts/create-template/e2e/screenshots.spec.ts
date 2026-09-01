import { test } from '@playwright/test'
import {
  captureScreenshot,
  createMockScreenlyForScreenshots,
  RESOLUTIONS,
} from '@screenly/edge-apps/test/screenshots'

const { screenlyJsContent } = createMockScreenlyForScreenshots()

for (const { width, height } of RESOLUTIONS) {
  test(`screenshot ${width}x${height}`, async ({ browser }) => {
    await captureScreenshot(
      browser,
      width,
      height,
      '{{APP_NAME}}',
      screenlyJsContent,
      async () => {},
    )
  })
}
