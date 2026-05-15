GitHub Pages ESG HTML Starter
===============================

这个包是给“很多个 HTML 学习网页”准备的 GitHub Pages 起步结构。

目录结构：

repo-root/
└── docs/
    ├── index.html                 # 总目录首页
    ├── .nojekyll                  # 让 GitHub Pages 不用 Jekyll 处理，直接发布静态文件
    └── ch01/
        └── esg_ch1_module1_1-1-1_to_1-1-2.html

使用方法：

1. 在 GitHub 新建一个 Public repository，例如 esg-pages。
2. 把 docs 文件夹拖到仓库页面的 Add file -> Upload files 中上传。
3. 进入 Settings -> Pages。
4. Source 选择 Deploy from a branch。
5. Branch 选择 main，Folder 选择 /docs，然后 Save。
6. 等发布完成后，打开：
   https://你的GitHub用户名.github.io/esg-pages/

以后新增网页：

1. 按章节放文件，例如：
   docs/ch02/esg_ch2_module1_xxx.html
2. 打开 docs/index.html，复制一个 <a class="card" ...>...</a> 链接块。
3. 把 href 改成新文件路径，例如：ch02/esg_ch2_module1_xxx.html。
4. Commit changes 后，GitHub Pages 会重新发布。

文件命名建议：

- 推荐：esg_ch1_module1_1-1-1_to_1-1-2.html
- 不推荐：第一章 第一节.html

原因：英文小写、数字、连字符/下划线在 iPad 和浏览器里更稳定，不容易被 URL 转码。
