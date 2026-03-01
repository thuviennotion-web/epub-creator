const fs = require('fs');
const path = require('path');
const { marked } = require('marked'); // Import thư viện Markdown

// ==========================================
// CẤU HÌNH THÔNG TIN SÁCH
// ==========================================
const bookConfig = {
    title: "Dẫn Voi Mai Kia",
    author: "Tên Tác Giả",
    language: "vi",
    identifier: "urn:uuid:12345678-1234-5678-1234-567812345678"
};

const inputDir = './raw_md';  // Đã đổi sang thư mục chứa file .md
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

    // Lấy dòng đầu tiên làm tiêu đề, tự động gọt bỏ dấu '#' nếu có
    const titleLine = lines[0];
    const cleanTitle = titleLine.replace(/^#+\s*/, ''); 
    
    const titleLower = cleanTitle.toLowerCase();
    const isPart = titleLower.startsWith('phần') || titleLower.startsWith('quyển') || titleLower.startsWith('tập');
    
    let bodyHtml = '';
    if (isPart) {
        bodyHtml += `    <h1 class="part-title">${cleanTitle}</h1>\n`;
    } else {
        bodyHtml += `    <h1>${cleanTitle}</h1>\n`;
    }
    
    let chapterNotesHtml = '';
    let markdownBodyLines = [];
    
    // Tách riêng phần thân (body) và phần chú thích (footnotes)
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        const noteMatch = line.match(/^\[(\d+)\]:\s*(.+)$/);
        
        if (noteMatch) {
            const noteId = noteMatch[1];
            // Render nội dung chú thích bằng marked (hỗ trợ in đậm/nghiêng trong chú thích)
            const noteText = marked.parseInline(noteMatch[2]);
            
            chapterNotesHtml += `        <aside epub:type="footnote" id="fn_${fileId}_${noteId}">\n            <p><a href="${outputFileName}#ref${noteId}" class="footnote-return" title="Quay lại vị trí đọc"><strong>${noteId}.</strong></a> ${noteText}</p>\n        </aside>\n`;
        } else {
            // Thay thế liên kết [1] thành thẻ HTML, giữ nguyên các cú pháp Markdown khác
            let processedLine = line.replace(/\[(\d+)\]/g, (match, p1) => {
                return `<a epub:type="noteref" href="notes.xhtml#fn_${fileId}_${p1}" id="ref${p1}" class="noteref">${p1}</a>`;
            });
            markdownBodyLines.push(processedLine);
        }
    }

    // BIÊN DỊCH TOÀN BỘ PHẦN THÂN TỪ MARKDOWN SANG HTML
    const rawMarkdown = markdownBodyLines.join('\n\n'); // Thêm dòng trống để marked hiểu là các đoạn <p>
    const compiledHtml = marked.parse(rawMarkdown);
    bodyHtml += compiledHtml;

    if (chapterNotesHtml !== '') {
        globalNotesHtml += `\n    <div class="chapter-notes-group">\n        <h3>${cleanTitle}</h3>\n${chapterNotesHtml}    </div>\n`;
    }

    const finalXhtml = xhtmlTemplate(cleanTitle, bodyHtml);
    fs.writeFileSync(path.join(outputDir, outputFileName), finalXhtml, 'utf-8');
    console.log(`   ✅ Đã dịch: ${outputFileName} ${isPart ? '(Bìa Phần)' : ''}`);

    manifestItems += `    <item id="${fileId}" href="Text/${outputFileName}" media-type="application/xhtml+xml"/>\n`;
    spineItems += `    <itemref idref="${fileId}"/>\n`;

    if (isPart) {
        if (insidePart) {
            navListItems += `                </ol>\n            </li>\n`; 
        }
        navListItems += `            <li>\n                <a href="Text/${outputFileName}">${cleanTitle}</a>\n                <ol>\n`; 
        insidePart = true;
    } else {
        if (insidePart) {
            navListItems += `                    <li><a href="Text/${outputFileName}">${cleanTitle}</a></li>\n`; 
        } else {
            navListItems += `            <li><a href="Text/${outputFileName}">${cleanTitle}</a></li>\n`; 
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

console.log('🎉 Xong! Hệ thống đã nâng cấp thành công lên Markdown!');