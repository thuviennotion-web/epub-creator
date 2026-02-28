const fs = require('fs');
const path = require('path');

const inputDir = './raw_txt'; 
const outputDir = './src/OEBPS/Text'; 

if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Khuôn mẫu XHTML chuẩn (Đã bỏ thẻ <hr/>)
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

const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.txt'));

files.forEach(file => {
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return;

    const title = lines[0];
    let bodyHtml = `    <h1>${title}</h1>\n`;
    let notesHtml = '';
    
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        
        // Bắt các dòng chú thích ở cuối file
        const noteMatch = line.match(/^\[(\d+)\]:\s*(.+)$/);
        
        if (noteMatch) {
            const noteId = noteMatch[1];
            const noteText = noteMatch[2];
            // Thêm hidden="hidden" để tàng hình tại chỗ
            notesHtml += `    <aside epub:type="footnote" id="fn${noteId}" hidden="hidden">\n        <p>${noteId}. ${noteText}</p>\n    </aside>\n`;
        } else {
            // Xử lý đoạn văn bình thường, đổi [1] thành link popup
            let processedLine = line.replace(/\[(\d+)\]/g, (match, p1) => {
                return `<a epub:type="noteref" href="#fn${p1}" class="noteref">${p1}</a>`;
            });
            
            bodyHtml += `    <p>${processedLine}</p>\n`;
        }
    }

    const finalXhtml = xhtmlTemplate(title, bodyHtml, notesHtml);
    
    const outputFileName = file.replace('.txt', '.xhtml');
    const outputPath = path.join(outputDir, outputFileName);
    
    fs.writeFileSync(outputPath, finalXhtml, 'utf-8');
    console.log(`✅ Đã xử lý tàng hình chú thích: ${outputFileName}`);
});

console.log('🎉 Hoàn tất quá trình chuyển đổi!');