"""Festive avatar presets (Don't Starve style, generated with the gateway image model).

Keys are fixed here; the API only accepts these, so no user input reaches a file path.
"""

PRESETS = {
    "santa": "Julemanden",
    "elf": "Nissen",
    "reindeer": "Rensdyret",
    "gingerbread": "Pebernøddemanden",
    "snowman": "Snemanden",
    "krampus": "Krampus",
    "stocking": "Julestrømpen",
    "tree": "Juletræet",
    "robin": "Rødhalsen",
    "mrsclaus": "Fru Claus",
    "nutcracker": "Nøddeknækkeren",
    "yulegoat": "Julebukken",
    "owl": "Uglen",
    "giftbiter": "Gavemonsteret",
    "lantern": "Lanternånden",
    "strawhorse": "Hesten",
    "pig": "Grisen",
    "yulecat": "Julekatten",
    "cocoa": "Kakaokoppen",
    "spider": "Edderkoppen",
    "gnome": "Nissen med sækken",
    "hare": "Haren",
    "frostwisp": "Frostånden",
    "pinecone": "Kogleskabningen",
    "wolf": "Ulven",
}


def preset_url(key: str) -> str:
    return f"/static/avatars/presets/{key}.png"
