# First Light

https://github.com/user-attachments/assets/c73c1297-568a-4991-acaf-82c623e116fe

First Light is a modernized continuation of [Home tab](https://github.com/olrenso/Obsidian-home-tab) by [olrenso](https://github.com/olrenso) — an [Obsidian](https://obsidian.md/) plugin that adds a browser-like default new tab with a search bar and a grid of starred files, now with ongoing updates and new features.

*Your vault, at first light.*

You can search any local file in your vault, both markdown notes and attachments.

![](images/home-tab.png)

This plugin is not meant to be a replacement for the default Quick switcher or any alternative one like [Another quick switcher](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher) (from which I took inspiration), but rather a faster way to open a note or a file after opening a new tab.

## What's new
Compared to the original Home tab, this fork continues development with:

- **Particle wordmark** — render the logo and title as an interactive particle grid that ripples around the cursor, with a monochrome mode and tunable canvas parameters
- **Heading search & jump** — search through document headings and automatically jump to the matched one, with a smart jump strategy
- **Web link suggestions** — detect web addresses typed in the search bar and offer to open them with the Web Viewer core plugin
- **Localization** — English and Simplified Chinese
- **Modernized settings tab** — rebuilt on Obsidian's declarative settings API, organized into sub-pages
- **Hide on blur** — optionally hide search results when the search bar loses focus
- **Debug mode** — detailed logging for search and match analysis

## How to use
By default, every new empty tab is automatically replaced with the Home tab view. You can disable this behavior in the settings and manually open a new Home tab through the command palette with the commands `Home tab: Open new Home tab` or `Home tab: Replace current tab`.

## Features
### Filter search by file type or extension
To easily find a file you can filter the search by using filters for the file type or the file extension.

You can activate a filter by writing the filter key (see table below) and pressing tab. To remove the filter press backspace.

![](images/search_filters.png)

#### Filters keys
The following filters are available:

| File type | File extension | 
| :-: | :-: | 
| `markdown` | `md`|
| `image` | `png`, `jpg`, `jpeg`, `svg`, `gif`, `bmp` | 
| `video` | `mp4`, `webm`, `ogv`, `mov`, `mkv` |
| `audio` | `mp3`, `wav`, `m4a`, `ogg`, `3gp`, `flac` |
| `pdf` | `pdf` |  
| `canvas` | `canvas` |

![](images/filters_gif.gif)

### Embedded search bar
You can embed the Home tab view in any note with options to show recent files, starred files, or only the search bar.

To embed the search bar to a note, you have to create a `search-bar` code block (see the following example).

To show only the search bar, without the title and the logo/icon, add (in a new line) `only search bar`.
To show the starred and recent files add, respectively, `show starred files` and `show recent files`.

For example, the following code block will render the search bar and the starred files.
````text
```search-bar
only search bar
show starred files
```
````

![](images/embedded_searchbar.png)


### Starred files
If enabled, starred files are automatically displayed under the search bar.

By hovering the top right corner, you can unstar a file or change the displayed icon.

![](images/starred_files-options.png)

## Settings

![](images/settings-tab.png)

---
## Known issues
The plugin may not work with (or interfere with) other plugins that replace the new tabs with their custom view, such as the [Obsidian-Surfing](https://github.com/PKM-er/Obsidian-Surfing) plugin.

---
# How to install
The plugin will be available directly from the [Obsidian plugin browser](https://obsidian.md/plugins?id=home-tab-plus).
Alternatively, you can install with [BRAT](https://github.com/TfTHacker/obsidian42-brat) by using the following links: `https://github.com/Moyf/obsidian-home-tab` or `Moyf/obsidian-home-tab`.

