"""Recolorea un PNG con transparencia (tinta sólida + alpha) a un color plano,
preservando el alpha -- para usar la misma marca sobre fondos oscuros."""
import sys
from PIL import Image


def recolor(path_in, path_out, hex_color):
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    img = Image.open(path_in).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            _, _, _, a = pixels[x, y]
            pixels[x, y] = (r, g, b, a)
    img.save(path_out)
    print(f"Guardado: {path_out}")


if __name__ == "__main__":
    recolor(sys.argv[1], sys.argv[2], sys.argv[3])
