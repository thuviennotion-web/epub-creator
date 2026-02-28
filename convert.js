const fs = require('fs');
const path = require('path');

// ==========================================
// CẤU HÌNH THÔNG TIN SÁCH
// ==========================================
const bookConfig = {
    title: "Dẫn Voi Mai Kia",
    author: "Tên Tác Giả",
    language: "vi",
    identifier: "urn:uuid:12345678-1234-5678-1234-567812345678"
};

const inputDir = './raw_txt'; 
const outputDir = './src/OEBPS/Text'; 
const oebpsDir = './src/OEBPS';

if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Xóa file xhtml cũ trước khi build lại
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

const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.txt')).sort();

if (files.length === 0) {
    console.log('⚠️ Không tìm thấy file .txt nào.');
    process.exit(1);
}

let manifestItems = `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;
manifestItems += `    <item id="css" href="Styles/style.css" media-type="text/css"/>\n`;

// Tự động nhúng toàn bộ Font (Gồm cả Averta, Crimson, Argentum Novus)
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

console.log(`🔄 Đang build ${files.length} file...`);

files.forEach(file => {
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    // Yêu cầu file txt có tối thiểu 2 dòng (Nhãn và Tên)
    if (lines.length < 2) return;

    const outputFileName = file.replace('.txt', '.xhtml');
    const fileId = file.replace('.txt', ''); 

    // Dòng 1 là Label (CHƯƠNG 1), Dòng 2 là Title (Tên chương)
    const chapterLabel = lines[0];
    const chapterTitle = lines[1];
    const displayTitle = `${chapterLabel}: ${chapterTitle}`; // Tên dùng trên thanh tiêu đề ứng dụng
    
    // Gán class để CSS nhận diện và áp dụng Drop Cap cho thẻ <p> ngay sau nó
    let bodyHtml = `    <h2 class="chapter-label">${chapterLabel}</h2>\n    <h1 class="chapter-title">${chapterTitle}</h1>\n`;
    let chapterNotesHtml = '';
    
    // Chạy vòng lặp từ dòng thứ 3 (index 2) để lấy nội dung văn bản
    for (let i = 2; i < lines.length; i++) {
        let line = lines[i];
        const noteMatch = line.match(/^\[(\d+)\]:\s*(.+)$/);
        
        if (noteMatch) {
            const noteId = noteMatch[1];
            const noteText = noteMatch[2];
            chapterNotesHtml += `        <aside epub:type="footnote" id="fn_${fileId}_${noteId}">\n            <p><a href="${outputFileName}#ref${noteId}" class="footnote-return" title="Quay lại vị trí đọc"><strong>${noteId}.</strong></a> ${noteText}</p>\n        </aside>\n`;
        } else if (line.startsWith('### ')) {
            bodyHtml += `    <h3>${line.substring(4).trim()}</h3>\n`;
        } else if (line.startsWith('## ')) {
            bodyHtml += `    <h2>${line.substring(3).trim()}</h2>\n`;
        } else {
            let processedLine = line.replace(/\[(\d+)\]/g, (match, p1) => {
                return `<a epub:type="noteref" href="notes.xhtml#fn_${fileId}_${p1}" id="ref${p1}" class="noteref">${p1}</a>`;
            });
            bodyHtml += `    <p>${processedLine}</p>\n`;
        }
    }

    if (chapterNotesHtml !== '') {
        globalNotesHtml += `\n    <div class="chapter-notes-group">\n        <h3>${chapterLabel} - ${chapterTitle}</h3>\n${chapterNotesHtml}    </div>\n`;
    }

    const finalXhtml = xhtmlTemplate(displayTitle, bodyHtml);
    fs.writeFileSync(path.join(outputDir, outputFileName), finalXhtml, 'utf-8');
    console.log(`   ✅ Đã tạo: ${outputFileName}`);

    manifestItems += `    <item id="${fileId}" href="Text/${outputFileName}" media-type="application/xhtml+xml"/>\n`;
    spineItems += `    <itemref idref="${fileId}"/>\n`;
    
    // Mục lục phẳng chuẩn mực cho Calibre (Ghi gộp Nhãn và Tên)
    navListItems += `            <li><a href="Text/${outputFileName}">${chapterLabel} - ${chapterTitle}</a></li>\n`;
});

// TẠO FILE TỔNG HỢP: notes.xhtml
if (globalNotesHtml !== '') {
    const notesTitle = "Toàn bộ chú thích";
    const notesBody = `    <h1>${notesTitle}</h1>\n    <section epub:type="footnotes" class="footnotes-section">\n${globalNotesHtml}    </section>\n`;
    const finalNotesXhtml = xhtmlTemplate(notesTitle, notesBody);
    fs.writeFileSync(path.join(outputDir, 'notes.xhtml'), finalNotesXhtml, 'utf-8');
    manifestItems += `    <item id="notes" href="Text/notes.xhtml" media-type="application/xhtml+xml"/>\n`;
    spineItems += `    <itemref idref="notes" linear="no"/>\n`;
}

// CẬP NHẬT CONTENT.OPF
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

// CẬP NHẬT NAV.XHTML
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

console.log('🎉 Xong! Toàn bộ Epub đã được Build với đầy đủ Font và cấu trúc xịn xò!');