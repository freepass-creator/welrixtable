#!/usr/bin/env python3
"""PDF → PNG 페이지별 변환 (Claude Vision 입력용)

사용:
    python scripts/pdf2png.py <pdf_path> <out_dir>
"""
import sys
import os
import fitz  # PyMuPDF


def convert(pdf_path: str, out_dir: str, zoom: float = 2.0):
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    base = os.path.splitext(os.path.basename(pdf_path))[0]
    paths = []
    for i, page in enumerate(doc, start=1):
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        out_path = os.path.join(out_dir, f'{base}_p{i:02d}.png')
        pix.save(out_path)
        paths.append(out_path)
        print(f'  ✓ p{i}: {out_path} ({pix.width}x{pix.height})')
    print(f'\n총 {len(paths)} 페이지')
    return paths


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('사용: python pdf2png.py <pdf_path> <out_dir>')
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
