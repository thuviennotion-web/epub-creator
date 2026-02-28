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

const xhtmlTemplate = (title, bodyContent, notesContent) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">
<head>
    <title>${title}</title>
    <link href="../Styles/style.css" rel="stylesheet" type="text/css"/>
</head>
<body>
${bodyContent}
${notesContent}
</body>
</html>`;

const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.txt')).sort();

if (files.length === 0) {
    console.log('⚠️ Không tìm thấy file .txt nào.');
    process.exit(1);
}

let manifestItems = `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;
manifestItems += `    <item id="css" href="Styles/style.css" media-type="text/css"/>\n`;
let spineItems = ``;
let navListItems = ``;

console.log(`🔄 Đang tiến hành build lại toàn bộ ${files.length} chương...`);

files.forEach(file => {
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return;

    const outputFileName = file.replace('.txt', '.xhtml');
    const fileId = file.replace('.txt', ''); 

    const title = lines[0];
    let bodyHtml = `    <h1>${title}</h1>\n`;
    let notesHtml = '';
    
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        const noteMatch = line.match(/^\[(\d+)\]:\s*(.+)$/);
        
        if (noteMatch) {
            const noteId = noteMatch[1];
            const noteText = noteMatch[2];
            // Khai báo thẻ footnote CHUẨN KÈM NÚT QUAY LẠI
            notesHtml += `        <aside epub:type="footnote" id="fn${noteId}">\n            <p><a href="${outputFileName}#ref${noteId}" class="back-link" title="Quay lại">↑</a> <strong>${noteId}.</strong> ${noteText}</p>\n        </aside>\n`;
            
        } else if (line.startsWith('### ')) {
            const h3Text = line.substring(4).trim();
            bodyHtml += `    <h3>${h3Text}</h3>\n`;
        } else if (line.startsWith('## ')) {
            const h2Text = line.substring(3).trim();
            bodyHtml += `    <h2>${h2Text}</h2>\n`;
        } else {
            // Thay thế liên kết chú thích: có epub:type để popup, có id=ref để nút quay lại hoạt động
            let processedLine = line.replace(/\[(\d+)\]/g, (match, p1) => {
                return `<a epub:type="noteref" href="${outputFileName}#fn${p1}" id="ref${p1}" class="noteref">${p1}</a>`;
            });
            bodyHtml += `    <p>${processedLine}</p>\n`;
        }
    }

    // Đóng gói toàn bộ ghi chú vào thẻ section CHUẨN QUỐC TẾ
    let finalNotesSection = '';
    if (notesHtml !== '') {
        finalNotesSection = `\n    <hr class="footnote-divider"/>\n    <section epub:type="footnotes" class="footnotes-section">\n${notesHtml}    </section>\n`;
    }

    const finalXhtml = xhtmlTemplate(title, bodyHtml, finalNotesSection);
    fs.writeFileSync(path.join(outputDir, outputFileName), finalXhtml, 'utf-8');
    console.log(`   ✅ Đã tạo: ${outputFileName}`);

    manifestItems += `    <item id="${fileId}" href="Text/${outputFileName}" media-type="application/xhtml+xml"/>\n`;
    spineItems += `    <itemref idref="${fileId}"/>\n`;
    navListItems += `            <li><a href="Text/${outputFileName}">${title}</a></li>\n`;
});

// Cập nhật content.opf và nav.xhtml
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

console.log('🎉 Xong! Đã build cấu trúc Footnotes Hybrid!');