# package-clean

Search JS files and compare with package.json figure out which dependencies are unuse

```
  Usage: index [options] <folder|file...>

  Search JS files and compare with package.json figure out which dependencies are unuse

  Options:
  -h, --help             output usage information
  -V, --version          output the version number
  -E, --exclude <items>  exclude file or folder
```

## Install

```
npm install -g package-clean
```

## Example

```
package-clean .
package-clean . --exlcude=assets
```
