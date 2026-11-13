import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./src/index.ts');
// Fonts are served straight from the design folder, so the video and the
// mockups always use the same files.
Config.setPublicDir('../../docs/design/fonts');
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
