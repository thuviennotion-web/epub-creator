const fs = require('fs');
const path = require('path');

// ==========================================
// 1. CẤU HÌNH THÔNG TIN SÁCH (Sửa tại đây)
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

// Khuôn mẫu XHTML cho từng chương
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

// Đọc và SẮP XẾP các file txt theo thứ tự tên (chuong-01, chuong-02...)
const files = fs.readdirSync(inputDir)
                .filter(file => file.endsWith('.txt'))
                .sort(); // Đảm bảo chương 1 luôn đứng trước chương 2

// Khởi tạo các biến để gom dữ liệu cho OPF và NAV
let manifestItems = `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;
manifestItems += `    <item id="css" href="Styles/style.css" media-type="text/css"/>\n`;
let spineItems = ``;
let navListItems = ``;

files.forEach(file => {
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return;

    // Lấy dòng đầu tiên làm tiêu đề h1
    const title = lines[0];
    let bodyHtml = `    <h1>${title}</h1>\n`;
    let notesHtml = '';
    
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        const noteMatch = line.match(/^\[(\d+)\]:\s*(.+)$/);
        
        if (noteMatch) {
            // 1. Xử lý dòng chú thích ở cuối file
            const noteId = noteMatch[1];
            const noteText = noteMatch[2];
            notesHtml += `    <aside epub:type="footnote" id="fn${noteId}" hidden="hidden">\n        <p>${noteId}. ${noteText}</p>\n    </aside>\n`;
            
        } else if (line.startsWith('### ')) {
            // 2. Nhận diện thẻ h3 (3 dấu thăng)
            const h3Text = line.substring(4).trim();
            bodyHtml += `    <h3>${h3Text}</h3>\n`;
            
        } else if (line.startsWith('## ')) {
            // 3. Nhận diện thẻ h2 (2 dấu thăng)
            const h2Text = line.substring(3).trim();
            bodyHtml += `    <h2>${h2Text}</h2>\n`;
            
        } else {
            // 4. Xử lý đoạn văn bình thường (<p>)
            let processedLine = line.replace(/\[(\d+)\]/g, (match, p1) => {
                return `<a epub:type="noteref" href="#fn${p1}" class="noteref">${p1}</a>`;
            });
            bodyHtml += `    <p>${processedLine}</p>\n`;
        }
    }

    const finalXhtml = xhtmlTemplate(title, bodyHtml, notesHtml);
    const outputFileName = file.replace('.txt', '.xhtml');
    const fileId = file.replace('.txt', ''); // ví dụ: chuong-01
    
    // Ghi file .xhtml
    fs.writeFileSync(path.join(outputDir, outputFileName), finalXhtml, 'utf-8');
    console.log(`✅ Đã xử lý: ${outputFileName}`);

    // ==========================================
    // GOM DỮ LIỆU ĐỂ TẠO MANIFEST, SPINE VÀ NAV
    // ==========================================
    manifestItems += `    <item id="${fileId}" href="Text/${outputFileName}" media-type="application/xhtml+xml"/>\n`;
    spineItems += `    <itemref idref="${fileId}"/>\n`;
    navListItems += `            <li><a href="Text/${outputFileName}">${title}</a></li>\n`;
});

// ==========================================
// 2. TỰ ĐỘNG TẠO FILE content.opf
// ==========================================
const modifiedDate = new Date().toISOString().split('.')[0] + 'Z'; // Lấy giờ hiện tại chuẩn ISO
const opfContent = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${bookConfig.title}</dc:title>
    <dc:creator>${bookConfig.author}</dc:creator>
    <dc:language>${bookConfig.language}</dc:language>
    <dc:identifier id="bookid">${bookConfig.identifier}</dc:identifier>
    <meta property="dcterms:modified">${modifiedDate}</meta>
  </metadata>
  
  <manifest>
${manifestItems.trimEnd()}
  </manifest>

  <spine>
${spineItems.trimEnd()}
  </spine>
</package>`;

fs.writeFileSync(path.join(oebpsDir, 'content.opf'), opfContent, 'utf-8');
console.log(`📝 Đã cập nhật tự động: content.opf`);

// ==========================================
// 3. TỰ ĐỘNG TẠO FILE nav.xhtml (Mục lục)
// ==========================================
const navContent = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${bookConfig.language}" lang="${bookConfig.language}">
<head>
    <title>Mục lục</title>
</head>
<body>
    <nav epub:type="toc" id="toc">
        <h1>Mục lục</h1>
        <ol>
${navListItems.trimEnd()}
        </ol>
    </nav>
</body>
</html>`;

fs.writeFileSync(path.join(oebpsDir, 'nav.xhtml'), navContent, 'utf-8');
console.log(`📑 Đã cập nhật tự động: nav.xhtml`);

console.log('🎉 Xong! Dự án đã sẵn sàng để đẩy lên GitHub!');