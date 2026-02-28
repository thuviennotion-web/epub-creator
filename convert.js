const fs = require('fs');
const path = require('path');

// Cấu hình thư mục
const inputDir = './raw_txt'; // Thư mục chứa các file .txt của bạn
const outputDir = './src/OEBPS/Text'; // Thư mục xuất file .xhtml

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Khuôn mẫu XHTML chuẩn
const xhtmlTemplate = (title, bodyContent, notesContent) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">
<head>
    <title>${title}</title>
    <link href="../Styles/style.css" rel="stylesheet" type="text/css"/>
</head>
<body>
${bodyContent}
${notesContent ? `\n    <hr/>\n${notesContent}` : ''}
</body>
</html>`;

// Đọc tất cả file trong thư mục đầu vào
const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.txt'));

files.forEach(file => {
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Tách thành từng dòng và lọc bỏ các khoảng trắng thừa
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return;

    // Dòng đầu tiên là Tiêu đề
    const title = lines[0];
    let bodyHtml = `    <h1>${title}</h1>\n`;
    let notesHtml = '';
    
    // Xử lý các dòng còn lại
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        
        // Kiểm tra xem dòng này có phải là nội dung chú thích ở cuối bài không (VD: "[1]: Giải nghĩa...")
        const noteMatch = line.match(/^\[(\d+)\]:\s*(.+)$/);
        
        if (noteMatch) {
            const noteId = noteMatch[1];
            const noteText = noteMatch[2];
            notesHtml += `    <aside epub:type="footnote" id="fn${noteId}">\n        <p>${noteId}. ${noteText}</p>\n    </aside>\n`;
        } else {
            // Nếu là đoạn văn bình thường, tìm và thay thế các [1], [2] thành thẻ link popup
            let processedLine = line.replace(/\[(\d+)\]/g, (match, p1) => {
                return `<a epub:type="noteref" href="#fn${p1}" class="noteref">${p1}</a>`;
            });
            
            bodyHtml += `    <p>${processedLine}</p>\n`;
        }
    }

    // Ghép vào template
    const finalXhtml = xhtmlTemplate(title, bodyHtml, notesHtml);
    
    // Đổi đuôi file từ .txt sang .xhtml
    const outputFileName = file.replace('.txt', '.xhtml');
    const outputPath = path.join(outputDir, outputFileName);
    
    // Lưu file
    fs.writeFileSync(outputPath, finalXhtml, 'utf-8');
    console.log(`✅ Đã convert thành công: ${outputFileName}`);
});

console.log('🎉 Hoàn tất quá trình chuyển đổi toàn bộ thư mục!');