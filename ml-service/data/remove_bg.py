"""Quita el fondo blanco/casi-blanco de un PNG y lo deja transparente,
con un borde suavizado para que no queden pixeles blancos duros."""
import sys
from PIL import Image


def remove_white_bg(path_in, path_out, threshold=235, feather=25):
    img = Image.open(path_in).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            brightness = (r + g + b) / 3
            if brightness >= threshold:
                pixels[x, y] = (r, g, b, 0)
            elif brightness >= threshold - feather:
                factor = (threshold - brightness) / feather
                pixels[x, y] = (r, g, b, int(255 * factor))
    img.save(path_out)
    print(f"Guardado: {path_out}")


if __name__ == "__main__":
    remove_white_bg(sys.argv[1], sys.argv[2])
