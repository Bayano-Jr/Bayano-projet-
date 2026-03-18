import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  Header, 
  Footer, 
  PageNumber, 
  PageBreak,
  FootnoteReferenceRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from "docx";
import html2pdf from 'html2pdf.js';
import { Project, Chapter, PlanStructure } from '../types';
import { ExportOptions } from '../components/ExportModal';

export const exportChatToDOCX = async (messages: { role: string, content: string }[]) => {
  const parseInlineMarkdown = (text: string): TextRun[] => {
    const runs: TextRun[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: text.substring(lastIndex, match.index) }));
      }
      
      const matchedText = match[0];
      if (matchedText.startsWith('**')) {
        runs.push(new TextRun({ text: matchedText.slice(2, -2), bold: true }));
      } else {
        runs.push(new TextRun({ text: matchedText.slice(1, -1), italics: true }));
      }
      
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      runs.push(new TextRun({ text: text.substring(lastIndex) }));
    }

    return runs.length > 0 ? runs : [new TextRun({ text })];
  };

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Arial", size: 24 },
          paragraph: { spacing: { after: 120 } }
        },
        {
          id: "Heading1",
          name: "Heading 1",
          run: { font: "Arial", size: 32, bold: true },
          paragraph: { spacing: { before: 240, after: 120 } }
        }
      ]
    },
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Conversation avec l'Assistant IA",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        ...messages.flatMap(m => {
          const rolePara = new Paragraph({
            children: [
              new TextRun({
                text: m.role === 'user' ? "Vous :" : "Assistant :",
                bold: true,
                color: m.role === 'user' ? "2563EB" : "059669"
              })
            ],
            spacing: { before: 200, after: 100 }
          });

          const contentParas = m.content.split('\n').map(line => {
            const isHeading = line.startsWith('#');
            const level = line.match(/^#+/)?.[0].length || 0;
            const text = line.replace(/^#+\s*/, '');
            const isList = line.trim().startsWith('- ') || line.trim().startsWith('* ');
            const listText = isList ? line.trim().substring(2) : text;

            return new Paragraph({
              children: parseInlineMarkdown(listText),
              heading: isHeading ? (level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3) : undefined,
              bullet: isList ? { level: 0 } : undefined,
            });
          });

          return [rolePara, ...contentParas];
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Conversation_IA_${new Date().toISOString().split('T')[0]}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const exportToDOCX = async (project: Project & { chapters: Chapter[] }, options: ExportOptions) => {
  const isStandardDoc = ['memoire', 'rapport', 'article'].includes(project.documentType || '');
  let globalFootnoteCounter = 1;
  const documentFootnotes: Record<number, { children: Paragraph[] }> = {};

  const getPlan = (): PlanStructure => {
    const defaultPlan: PlanStructure = {
      introduction: { titre: "", sections: [] },
      chapitres: [],
      conclusion_generale: "",
      bibliographie_indicative: []
    };
    try {
      if (!project.plan) return defaultPlan;
      return JSON.parse(project.plan);
    } catch {
      return defaultPlan;
    }
  };

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: {
            font: "Times New Roman",
            size: 24, // 12pt
          },
          paragraph: {
            spacing: { line: 360, before: 120, after: 120 }, // 1.5 line spacing
            alignment: AlignmentType.JUSTIFIED,
          },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          run: {
            font: "Times New Roman",
            size: 32, // 16pt
            bold: true,
            color: "000000",
          },
          paragraph: {
            spacing: { before: 480, after: 240 },
            alignment: AlignmentType.LEFT,
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          run: {
            font: "Times New Roman",
            size: 28, // 14pt
            bold: true,
          },
          paragraph: {
            spacing: { before: 360, after: 180 },
          },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: project.title || "",
                  size: 18,
                  color: "888888",
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  children: ["Page ", PageNumber.CURRENT],
                  size: 18,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: [
        // Title Page
        ...(options.includeTitlePage ? [
          new Paragraph({
            text: (project.university || "").toUpperCase(),
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: project.field || "",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "\n\n\n\n\n\n" }),
          new Paragraph({
            text: project.documentType === 'tp' ? "TRAVAIL PRATIQUE" : 
                  project.documentType === 'rapport' ? "RAPPORT DE STAGE" : 
                  project.documentType === 'article' ? "ARTICLE SCIENTIFIQUE" : 
                  project.documentType === 'memoire' ? "MÉMOIRE DE FIN D'ÉTUDES" :
                  (project.documentType?.toUpperCase() || "DOCUMENT"),
            alignment: AlignmentType.CENTER,
            run: { size: 28, bold: true },
          }),
          new Paragraph({ text: "\n" }),
          new Paragraph({
            text: project.title || "",
            alignment: AlignmentType.CENTER,
            run: { size: 48, bold: true, font: "Times New Roman" },
          }),
          new Paragraph({ text: "\n\n\n\n\n" }),
          new Paragraph({
            text: `Présenté par: [VOTRE NOM]`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Niveau: ${project.level || ""}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "\n\n\n\n" }),
          new Paragraph({
            text: `Sous la direction de: [NOM DU DIRECTEUR]`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "\n\n\n\n" }),
          new Paragraph({
            text: `${project.country || ""}, ${new Date().getFullYear()}`,
            alignment: AlignmentType.CENTER,
          }),
          new PageBreak(),
        ] : []),

        // Table of Contents (Manual list)
        ...(options.includeTableOfContents ? [
          new Paragraph({
            text: "TABLE DES MATIÈRES",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          ...(isStandardDoc ? [
            new Paragraph({ text: "Éléments Préliminaires", spacing: { before: 200 } })
          ] : []),
          ...(project.chapters || [])
            .filter(c => c.order_index >= 0)
            .sort((a, b) => a.order_index - b.order_index)
            .map(ch => new Paragraph({ 
              text: ch.title || "",
              spacing: { before: 100 }
            })),
          new PageBreak(),
        ] : []),

        // Chapters
        ...(project.chapters || []).sort((a,b) => a.order_index - b.order_index).flatMap((ch: any) => {
          if (ch.order_index === -1) {
            // Front matter parsing
            try {
              const fm = JSON.parse(ch.content);
              if (!isStandardDoc) {
                return [
                  new Paragraph({ text: fm.page_de_garde || "", alignment: AlignmentType.CENTER }),
                  new PageBreak(),
                ];
              }
              return [
                new Paragraph({ text: "RÉSUMÉ", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                new Paragraph({ text: fm.resume_fr || "" }),
                new PageBreak(),
                new Paragraph({ text: "ABSTRACT", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: fm.abstract_en || "", italics: true })] }),
                new PageBreak(),
                new Paragraph({ text: "REMERCIEMENTS", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                new Paragraph({ text: fm.remerciements || "" }),
                new PageBreak(),
                ...(fm.sigles && fm.sigles.length > 0 ? [
                  new Paragraph({ text: "LISTE DES SIGLES", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                  ...fm.sigles.map((s: string) => new Paragraph({ text: s, bullet: { level: 0 } })),
                  new PageBreak(),
                ] : []),
              ];
            } catch {
              return [];
            }
          }

          // Skip bibliography/annexes if not selected
          const chTitle = ch.title || "";
          if (chTitle.toLowerCase().includes('bibliographie') && !options.includeBibliography) return [];
          if (chTitle.toLowerCase().includes('annexe') && !options.includeAnnexes) return [];

          const cleanTitleContent = (title: string, content: string) => {
            if (!content) return content;
            const lines = content.split('\n');
            let firstNonEmptyLineIdx = 0;
            while (firstNonEmptyLineIdx < lines.length && lines[firstNonEmptyLineIdx].trim() === '') {
              firstNonEmptyLineIdx++;
            }
            
            if (firstNonEmptyLineIdx < lines.length) {
              const firstLine = lines[firstNonEmptyLineIdx].trim();
              const titleRegex = new RegExp(`^#+\\s*\\**${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\**\\s*$`, 'i');
              if (titleRegex.test(firstLine)) {
                lines.splice(firstNonEmptyLineIdx, 1);
                return lines.join('\n').trim();
              }
              if (title.toUpperCase().includes('INTRODUCTION') && /^#+\s*\**INTRODUCTION\**\s*$/i.test(firstLine)) {
                lines.splice(firstNonEmptyLineIdx, 1);
                return lines.join('\n').trim();
              }
              if (title.toUpperCase().includes('CONCLUSION') && /^#+\s*\**CONCLUSION( GÉNÉRALE)?\**\s*$/i.test(firstLine)) {
                lines.splice(firstNonEmptyLineIdx, 1);
                return lines.join('\n').trim();
              }
            }
            return content;
          };

          const cleanedContent = cleanTitleContent(chTitle, ch.content || '');

          // Parse footnotes in chapter content
          const localToGlobalFootnoteMap = new Map<string, number>();
          const contentLines = cleanedContent.split('\n');
          const cleanContentLines: string[] = [];
          
          contentLines.forEach((line: string) => {
            const footnoteDefMatch = line.match(/^\[\^(\d+)\]:\s*(.*)/);
            if (footnoteDefMatch) {
              const localId = footnoteDefMatch[1];
              const text = footnoteDefMatch[2];
              const globalId = globalFootnoteCounter++;
              localToGlobalFootnoteMap.set(localId, globalId);
              documentFootnotes[globalId] = {
                children: [new Paragraph({ text: text })]
              };
            } else {
              cleanContentLines.push(line);
            }
          });

          // Helper to parse inline markdown (bold, italic)
          const parseInlineMarkdown = (text: string): TextRun[] => {
            const runs: TextRun[] = [];
            const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(text)) !== null) {
              if (match.index > lastIndex) {
                runs.push(new TextRun({ text: text.substring(lastIndex, match.index) }));
              }
              
              const matchedText = match[0];
              if (matchedText.startsWith('**')) {
                runs.push(new TextRun({ text: matchedText.slice(2, -2), bold: true }));
              } else {
                runs.push(new TextRun({ text: matchedText.slice(1, -1), italics: true }));
              }
              
              lastIndex = regex.lastIndex;
            }

            if (lastIndex < text.length) {
              runs.push(new TextRun({ text: text.substring(lastIndex) }));
            }

            return runs.length > 0 ? runs : [new TextRun({ text })];
          };

          const chapterParagraphs: any[] = [];
          let i = 0;
          
          const createParagraph = (line: string) => {
            const isHeading = line.startsWith('#');
            const level = line.match(/^#+/)?.[0].length || 0;
            const text = line.replace(/^#+\s*/, '');
            const isList = line.trim().startsWith('- ') || line.trim().startsWith('* ');
            const listText = isList ? line.trim().substring(2) : text;
            
            const parts: (TextRun | FootnoteReferenceRun)[] = [];
            let lastIndex = 0;
            const footnoteRegex = /\[\^(\d+)\]/g;
            let match;

            while ((match = footnoteRegex.exec(listText)) !== null) {
              if (match.index > lastIndex) {
                parts.push(...parseInlineMarkdown(listText.substring(lastIndex, match.index)));
              }
              const localId = match[1];
              let globalId = localToGlobalFootnoteMap.get(localId);
              if (globalId === undefined) {
                globalId = globalFootnoteCounter++;
                localToGlobalFootnoteMap.set(localId, globalId);
                documentFootnotes[globalId] = {
                  children: [new Paragraph({ text: "Note manquante" })]
                };
              }
              parts.push(new FootnoteReferenceRun(globalId));
              lastIndex = footnoteRegex.lastIndex;
            }

            if (lastIndex < listText.length) {
              parts.push(...parseInlineMarkdown(listText.substring(lastIndex)));
            }

            return new Paragraph({
              children: parts.length > 0 ? parts : parseInlineMarkdown(listText),
              heading: isHeading ? (level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3) : undefined,
              alignment: isHeading ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
              bullet: isList ? { level: 0 } : undefined,
            });
          };

          while (i < cleanContentLines.length) {
            const line = cleanContentLines[i];
            
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
              const tableLines = [];
              while (i < cleanContentLines.length && cleanContentLines[i].trim().startsWith('|') && cleanContentLines[i].trim().endsWith('|')) {
                tableLines.push(cleanContentLines[i]);
                i++;
              }
              
              if (tableLines.length >= 2 && tableLines[1].includes('---')) {
                const rows = tableLines.filter((_, idx) => idx !== 1).map((rowLine, rowIdx) => {
                  const cells = rowLine.split('|').slice(1, -1).map(c => c.trim());
                  return new TableRow({
                    children: cells.map(cellText => new TableCell({
                      children: [new Paragraph({ 
                        children: parseInlineMarkdown(cellText),
                        alignment: AlignmentType.CENTER
                      })],
                      margins: { top: 100, bottom: 100, left: 100, right: 100 },
                      shading: rowIdx === 0 ? { fill: "F3F4F6" } : undefined
                    }))
                  });
                });
                
                chapterParagraphs.push(new Table({
                  rows: rows,
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }
                  }
                }));
                chapterParagraphs.push(new Paragraph({ text: "" })); // Spacing after table
              } else {
                tableLines.forEach(l => {
                  if (l.trim() !== '') chapterParagraphs.push(createParagraph(l));
                });
              }
            } else {
              if (line.trim() !== '') {
                chapterParagraphs.push(createParagraph(line));
              }
              i++;
            }
          }

          return [
            new Paragraph({
              text: (ch.title || "").toUpperCase(),
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 400 },
            }),
            ...chapterParagraphs,
            new PageBreak(),
          ];
        }),
      ],
    }],
    footnotes: documentFootnotes
  });

  const blob = await Packer.toBlob(doc);
  return blob;
};

export const downloadDOCX = async (project: Project & { chapters: Chapter[] }, options: ExportOptions) => {
  const blob = await exportToDOCX(project, options);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const generateDOCXBase64 = async (project: Project & { chapters: Chapter[] }): Promise<string> => {
  const blob = await exportToDOCX(project, {
    includeTitlePage: true,
    includeTableOfContents: true,
    includeBibliography: true,
    includeAnnexes: true
  });
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const exportToPDF = async (project: Project, elementId: string) => {
  const originalElement = document.getElementById(elementId);
  if (!originalElement) return;

  try {
    const clone = originalElement.cloneNode(true) as HTMLElement;
    
    // Create a canvas context for color conversion
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const convertColor = (colorStr: string) => {
      if (!ctx || !colorStr.includes('oklch')) return colorStr;
      const prev = ctx.fillStyle;
      ctx.fillStyle = colorStr;
      const converted = ctx.fillStyle;
      ctx.fillStyle = prev;
      return converted;
    };

    // Get all elements in original and clone
    const originalElements = [originalElement, ...Array.from(originalElement.querySelectorAll('*'))];
    const cloneElements = [clone, ...Array.from(clone.querySelectorAll('*'))];

    // Apply computed styles from original to clone as inline styles
    for (let i = 0; i < originalElements.length; i++) {
      const origEl = originalElements[i] as HTMLElement;
      const cloneEl = cloneElements[i] as HTMLElement;
      
      const styles = window.getComputedStyle(origEl);
      
      const propsToCopy = [
        'color', 'background-color', 'border-color', 'border-width', 'border-style',
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
        'text-align', 'text-decoration', 'text-transform', 'letter-spacing',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'display', 'flex-direction', 'justify-content', 'align-items',
        'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
        'border-radius', 'box-shadow', 'opacity', 'visibility'
      ];
      
      let cssText = '';
      for (const prop of propsToCopy) {
        let val = styles.getPropertyValue(prop);
        if (val && val !== 'none' && val !== 'normal' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)') {
          if (val.includes('oklch')) {
            val = convertColor(val);
          }
          cssText += `${prop}: ${val}; `;
        }
      }
      
      cloneEl.style.cssText = cssText;
      // Remove class to prevent html2canvas from using the stylesheet
      cloneEl.removeAttribute('class');
    }

    const opt = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: `${project.title}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        letterRendering: true,
        logging: false,
        ignoreElements: (el: Element) => el.tagName === 'STYLE' || el.tagName === 'LINK'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // @ts-ignore
    await html2pdf().from(clone).set(opt).save();
  } catch (error) {
    console.error("Export pdf failed:", error);
    throw new Error("L'exportation PDF a échoué. Veuillez utiliser le bouton 'Imprimer' à la place.");
  }
};
