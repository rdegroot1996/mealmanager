# Public artwork

`social-preview.png` is the 1280 × 640 GitHub/README image. Important content stays inside GitHub's 40px safe margin. Its HTML source embeds fonts, captures the rendered large AppBrand at 2.5× scale, and uses canonical app icons. Lora 500 is the wordmark/heading font; DM Sans is supporting text.

To regenerate from the repository root, install frontend dependencies and Playwright CLI, then start the mock server at port 4200 in another terminal. Then run:

```shell
node scripts/generate-social-preview.mjs
```

The capture uses local fonts and the running mock; the generated HTML needs no network. Review the card at full and half size after branding/copy changes. Uploading the image to GitHub's repository social-preview setting is a separate maintainer action.
