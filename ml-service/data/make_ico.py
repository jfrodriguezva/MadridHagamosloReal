"""Genera un .ico con entradas BMP sin comprimir (32bpp + alpha) --
el compilador de recursos Win32 de csc/rc a veces rechaza los .ico
que Pillow guarda con entradas PNG."""
import struct
import sys
from PIL import Image


def make_ico(src_path, out_path, sizes=(16, 32, 48, 256)):
    base = Image.open(src_path).convert("RGBA")
    entries = []
    for size in sizes:
        img = base.resize((size, size), Image.LANCZOS)
        w, h = img.size
        # DIB header (BITMAPINFOHEADER) -- height es doble (color + mask AND)
        bmp_header = struct.pack(
            "<IiiHHIIiiII",
            40, w, h * 2, 1, 32, 0, w * h * 4, 0, 0, 0, 0,
        )
        # pixeles BGRA, de abajo hacia arriba
        pixels = bytearray()
        px = img.load()
        for y in range(h - 1, -1, -1):
            for x in range(w):
                r, g, b, a = px[x, y]
                pixels += bytes((b, g, r, a))
        and_mask = bytes((w // 8 or 1) * h)  # AND mask no usado (alpha manda), va en ceros
        data = bmp_header + bytes(pixels) + and_mask
        entries.append((size, data))

    with open(out_path, "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, len(entries)))
        offset = 6 + 16 * len(entries)
        for size, data in entries:
            wb = size if size < 256 else 0
            f.write(struct.pack("<BBBBHHII", wb, wb, 0, 0, 1, 32, len(data), offset))
            offset += len(data)
        for _, data in entries:
            f.write(data)
    print(f"Guardado: {out_path}")


if __name__ == "__main__":
    make_ico(sys.argv[1], sys.argv[2])
