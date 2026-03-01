const fs = require('fs');
const path = require('path');
const { marked } = require('marked'); 

// ==========================================
// CẤU HÌNH THÔNG TIN SÁCH
// ==========================================
const bookConfig = {
    title: "Dẫn Voi Mai Kia",
    author: "Tên Tác Giả",
    language: "vi",
    identifier: "urn:uuid:12345678-1234-5678-1234-567812345678"
};

const inputDir = './raw_md';  
const outputDir = './src/OEBPS/Text'; 
const oebpsDir = './src/OEBPS';

if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const oldFiles = fs.readdirSync(outputDir).filter(file => file.endsWith('.xhtml'));
oldFiles.forEach(file => fs.unlinkSync(path.join(outputDir, file)));

const xhtmlTemplate = (title, bodyContent) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">
<head>
    <title>${title}</title>
    <link href="../Styles/style.css" rel="stylesheet" type="text/css"/>
</head>
<body>
${bodyContent}
</body>
</html>`;

const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.md')).sort();

if (files.length === 0) {
    console.log('⚠️ Không tìm thấy file .md nào trong thư mục raw_md.');
    process.exit(1);
}

let manifestItems = `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;
manifestItems += `    <item id="css" href="Styles/style.css" media-type="text/css"/>\n`;

const fontsDir = './src/OEBPS/Fonts';
if (fs.existsSync(fontsDir)) {
    const fontFiles = fs.readdirSync(fontsDir).filter(file => file.match(/\.(ttf|otf|woff|woff2)$/i));
    fontFiles.forEach((file, index) => {
        let mediaType = 'font/ttf';
        if (file.endsWith('.otf')) mediaType = 'font/otf';
        manifestItems += `    <item id="font_${index}" href="Fonts/${file}" media-type="${mediaType}"/>\n`;
    });
}

const imagesDir = './src/OEBPS/Images';
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

if (fs.existsSync(imagesDir)) {
    const imageFiles = fs.readdirSync(imagesDir).filter(file => file.match(/\.(jpg|jpeg|png|gif|svg)$/i));
    imageFiles.forEach((file, index) => {
        let mediaType = 'image/jpeg';
        if (file.toLowerCase().endsWith('.png')) mediaType = 'image/png';
        else if (file.toLowerCase().endsWith('.gif')) mediaType = 'image/gif';
        else if (file.toLowerCase().endsWith('.svg')) mediaType = 'image/svg+xml';
        
        manifestItems += `    <item id="img_${index}" href="Images/${file}" media-type="${mediaType}"/>\n`;
    });
    console.log(`🖼️  Đã nhúng tự động ${imageFiles.length} file hình ảnh.`);
}

let spineItems = ``;
let navListItems = ``;
let globalNotesHtml = '';
let insidePart = false;

console.log(`🔄 Đang biên dịch ${files.length} file Markdown sang EPUB...`);

files.forEach(file => {
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return;

    const outputFileName = file.replace('.md', '.xhtml');
    const fileId = file.replace('.md', ''); 
    
    // Tự động nhận diện file nào là "Phần" dựa vào tên file (VD: 01-phan-1.md)
    const isPart = fileId.toLowerCase().includes('phan') || fileId.toLowerCase().includes('quyen');

    // ----------------------------------------------------
    // TRÍCH XUẤT TIÊU ĐỀ LÀM MỤC LỤC (KHỚP VỚI ẢNH 1)
    // ----------------------------------------------------
    let chapterLabel = '';
    let chapterTitle = '';
    let tocTitle = '';

    lines.forEach(line => {
        if (line.startsWith('## ') && !chapterLabel) chapterLabel = line.replace(/^##\s*/, '').trim();
        else if (line.startsWith('# ') && !chapterTitle) chapterTitle = line.replace(/^#\s*/, '').trim();
    });

    // Gom thành dạng "Lời nói đầu: Thời đại hoàng kim..."
    if (chapterLabel && chapterTitle) {
        tocTitle = `${chapterLabel}: ${chapterTitle}`; 
    } else {
        tocTitle = chapterTitle || chapterLabel || fileId;
    }

    // ----------------------------------------------------
    // XỬ LÝ NỘI DUNG CHÍNH
    // ----------------------------------------------------
    let chapterNotesHtml = '';
    let markdownBodyLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const noteMatch = line.match(/^\[(\d+)\]:\s*(.+)$/);
        
        if (noteMatch) {
            const noteId = noteMatch[1];
            const noteText = marked.parseInline(noteMatch[2]);
            // Tạo note ở danh sách cuối với số 1. chuẩn như cũ
            chapterNotesHtml += `        <aside epub:type="footnote" id="fn_${fileId}_${noteId}">\n            <p><a href="${outputFileName}#ref${noteId}" class="footnote-return" title="Quay lại vị trí đọc">${noteId}.</a> ${noteText}</p>\n        </aside>\n`;
        } else {
            markdownBodyLines.push(line);
        }
    }

    // Biên dịch bằng thư viện marked
    const rawMarkdown = markdownBodyLines.join('\n\n'); 
    let compiledHtml = marked.parse(rawMarkdown);

    // DÁN CLASS CSS CHO TIÊU ĐỀ ĐỂ TẠO DROP CAP
    if (isPart) {
        compiledHtml = compiledHtml.replace(/<h1([^>]*)>/i, '<h1 class="part-title"$1>');
    } else {
        // Chỉ dán class vào thẻ h1, h2 xuất hiện đầu tiên của chương
        compiledHtml = compiledHtml.replace(/<h1([^>]*)>/i, '<h1 class="chapter-title"$1>');
        compiledHtml = compiledHtml.replace(/<h2([^>]*)>/i, '<h2 class="chapter-label"$1>');
    }

    // Phục hồi chú thích trong văn bản thành số 1 gạch chân màu xanh (Khớp với Ảnh 2)
    compiledHtml = compiledHtml.replace(/\[(\d+)\]/g, (match, p1) => {
        return `<a epub:type="noteref" href="notes.xhtml#fn_${fileId}_${p1}" id="ref${p1}" class="noteref">${p1}</a>`;
    });

    if (chapterNotesHtml !== '') {
        globalNotesHtml += `\n    <div class="chapter-notes-group">\n        <h3>${tocTitle}</h3>\n${chapterNotesHtml}    </div>\n`;
    }

    const finalXhtml = xhtmlTemplate(chapterTitle || tocTitle, compiledHtml);
    fs.writeFileSync(path.join(outputDir, outputFileName), finalXhtml, 'utf-8');
    console.log(`   ✅ Đã dịch: ${outputFileName} ${isPart ? '(Bìa Phần)' : ''}`);

    manifestItems += `    <item id="${fileId}" href="Text/${outputFileName}" media-type="application/xhtml+xml"/>\n`;
    spineItems += `    <itemref idref="${fileId}"/>\n`;

    // ----------------------------------------------------
    // MỤC LỤC ĐA CẤP (NESTED TOC)
    // ----------------------------------------------------
    if (isPart) {
        if (insidePart) navListItems += `                </ol>\n            </li>\n`; 
        navListItems += `            <li>\n                <a href="Text/${outputFileName}">${tocTitle}</a>\n                <ol>\n`; 
        insidePart = true;
    } else {
        if (insidePart) {
            navListItems += `                    <li><a href="Text/${outputFileName}">${tocTitle}</a></li>\n`; 
        } else {
            navListItems += `            <li><a href="Text/${outputFileName}">${tocTitle}</a></li>\n`; 
        }
    }
});

if (insidePart) {
    navListItems += `                </ol>\n            </li>\n`;
}

if (globalNotesHtml !== '') {
    const notesTitle = "Toàn bộ chú thích";
    const notesBody = `    <h1>${notesTitle}</h1>\n    <section epub:type="footnotes" class="footnotes-section">\n${globalNotesHtml}    </section>\n`;
    const finalNotesXhtml = xhtmlTemplate(notesTitle, notesBody);
    fs.writeFileSync(path.join(outputDir, 'notes.xhtml'), finalNotesXhtml, 'utf-8');
    manifestItems += `    <item id="notes" href="Text/notes.xhtml" media-type="application/xhtml+xml"/>\n`;
    spineItems += `    <itemref idref="notes" linear="no"/>\n`;
}

const modifiedDate = new Date().toISOString().split('.')[0] + 'Z'; 
const opfContent = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${bookConfig.title}</dc:title>
    <dc:creator>${bookConfig.author}</dc:creator>
    <dc:language>${bookConfig.language}</dc:language>
    <dc:identifier id="bookid">${bookConfig.identifier}</dc:identifier>
    <meta property="dcterms:modified">${modifiedDate}</meta>
  </metadata>
  <manifest>\n${manifestItems.trimEnd()}\n  </manifest>
  <spine>\n${spineItems.trimEnd()}\n  </spine>
</package>`;
fs.writeFileSync(path.join(oebpsDir, 'content.opf'), opfContent, 'utf-8');

const navContent = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${bookConfig.language}" lang="${bookConfig.language}">
<head><title>Mục lục</title></head>
<body>
    <nav epub:type="toc" id="toc">
        <h1>Mục lục</h1>
        <ol>\n${navListItems.trimEnd()}\n        </ol>
    </nav>
</body>
</html>`;
fs.writeFileSync(path.join(oebpsDir, 'nav.xhtml'), navContent, 'utf-8');

console.log('🎉 Xong! Hệ thống đã nâng cấp toàn diện thiết kế CSS và cấu trúc Markdown!');