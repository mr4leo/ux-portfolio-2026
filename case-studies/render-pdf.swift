// Renders page 1 of a PDF into horizontal PNG slices, and writes its text.
// Usage: swift render-pdf.swift <in.pdf> <out-dir> <width-px> <slice-height-px>
// Called by build.py; run that instead.
import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 5, let width = Int(args[3]), let sliceHeight = Int(args[4]),
      let doc = PDFDocument(url: URL(fileURLWithPath: args[1])),
      let page = doc.page(at: 0), let cgPage = page.pageRef else {
  FileHandle.standardError.write("usage: render-pdf.swift in.pdf out-dir width slice-height\n".data(using: .utf8)!)
  exit(1)
}
let outDir = URL(fileURLWithPath: args[2])
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let box = cgPage.getBoxRect(.mediaBox)
let scale = CGFloat(width) / box.width
let totalHeight = Int((box.height * scale).rounded())

var index = 0
for top in stride(from: 0, to: totalHeight, by: sliceHeight) {
  index += 1
  let height = min(sliceHeight, totalHeight - top)
  let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpace(name: CGColorSpace.sRGB)!,
                      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.interpolationQuality = .high
  ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
  // PDF space starts bottom-left; shift so this slice's band lands in the bitmap.
  ctx.translateBy(x: 0, y: CGFloat(height + top - totalHeight))
  ctx.scaleBy(x: scale, y: scale)
  ctx.translateBy(x: -box.minX, y: -box.minY)
  ctx.drawPDFPage(cgPage)

  let url = outDir.appendingPathComponent(String(format: "%02d.png", index))
  let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
  CGImageDestinationFinalize(dest)
}

try (page.string ?? "").write(to: outDir.appendingPathComponent("text.txt"), atomically: true, encoding: .utf8)
print("\(index) slices, \(width)x\(totalHeight)")
