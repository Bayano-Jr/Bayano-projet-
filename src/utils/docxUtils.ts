import JSZip from 'jszip';

export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);
    
    // Find document.xml
    const documentXmlFile = loadedZip.file('word/document.xml');
    if (!documentXmlFile) {
      throw new Error('word/document.xml introuvable dans le fichier DOCX.');
    }
    
    const xmlString = await documentXmlFile.async('string');
    
    // Extract paragraphs
    const paragraphs = xmlString.match(/<w:p[^>]*>([\s\S]*?)<\/w:p>/g) || [];
    
    const text = paragraphs.map(p => {
      const texts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      return texts.map(t => {
        const innerText = t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
        return innerText
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
      }).join('');
    }).join('\n');
    
    return text;
  } catch (error) {
    console.error("Erreur lors de l'extraction du texte DOCX:", error);
    throw error;
  }
}

export async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);
    
    const documentXmlFile = loadedZip.file('word/document.xml');
    if (!documentXmlFile) {
      throw new Error('word/document.xml introuvable dans le fichier DOCX.');
    }
    
    const xmlString = await documentXmlFile.async('string');
    
    const paragraphs = xmlString.match(/<w:p[^>]*>([\s\S]*?)<\/w:p>/g) || [];
    
    const html = paragraphs.map(p => {
      const texts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const pText = texts.map(t => {
        const innerText = t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
        return innerText
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
      }).join('');
      
      if (!pText.trim()) return '';
      
      // Check if it's a heading
      if (p.includes('<w:pStyle w:val="Heading1"')) return `<h1>${pText}</h1>`;
      if (p.includes('<w:pStyle w:val="Heading2"')) return `<h2>${pText}</h2>`;
      if (p.includes('<w:pStyle w:val="Heading3"')) return `<h3>${pText}</h3>`;
      
      return `<p>${pText}</p>`;
    }).filter(p => p !== '').join('\n');
    
    return html || '<p>Document vide</p>';
  } catch (error) {
    console.error("Erreur lors de la conversion DOCX vers HTML:", error);
    throw error;
  }
}
