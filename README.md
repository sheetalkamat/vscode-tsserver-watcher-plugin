# vscode-tsserer-watcher-plugin
Plugin to watch file and directory watcher through vscode and extension [https://github.com/sheetalkamat/typescript-vscode-watcher](https://github.com/sheetalkamat/vscode-tsserver-watcher)

## Installing

```bash
git clone https://github.com/sheetalkamat/vscode-tsserer-watcher-plugin.git
cd vscode-tsserer-watcher-plugin
npm i
npm run build
npm link

cd ..
git clone https://github.com/sheetalkamat/vscode-tsserver-watcher.git
cd vscode-tsserver-watcher
npm i
npm link vscode-tsserer-watcher-plugin
npm run compile
```

## Usage

At this point set `watchFactory` to `vscode-tsserer-watcher-plugin` in `watchOptions`of vscode settings.
Open the vscode-tsserver-watcher repo in vscode and run.
In the vscode that gets opened, any typescript files or folders open will watch using the vscode plugin which uses Server to talk between plugin and vscode extension to watch files and directories using vscode native watchers.
