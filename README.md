# Svelte Matrix Client

This is my first test of Claude Code, creating a matrix client. every existing matrix client sucks, so being better than them isn't really a high bar. imo initial commit has already achieved this

things left to do:
- account registration
- account management
- functionality for creating or moderating rooms/spaces
- anything to do with encryption
- video and audio embeds (waiting on tuwunel to fix this first tho, i don't wanna spin up my own opengraph proxy service)
- voice and video calls, screen sharing
- configuration / theming / whatever
- no idea, let me know if something's missing

feel free to try it out :) i host a copy at https://matrix.crafty.moe/

same install process as every other js app

```
git clone https://github.com/az4521/svelte_matrix_client.git
cd svelte_matrix_client
npm i
npm run dev
```

if you wanna serve this, run `npm run build` and copy the files in build/ into a web directory. it's all static files so there's no backend to run