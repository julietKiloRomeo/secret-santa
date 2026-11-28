"""Ghost-loop achievements for Snake (Første Advent).

Ids remain stable so previously earned loop badges are preserved.
"""

GAME = "advent-1"

CATALOG = {
    f"{GAME}:loops:1": {
        "image": "badges/nidhogg.png",
        "track": "loops",
        "tier": 1,
        "name": "Nidhogg",
        "snark": "Du bed dig selv i halen. Med vilje. Systemets AI har oprettet en mappe med titlen 'Bekymrende hobbyer'. Et sted sidder en drage og tager noter.",
        "reward": "Belønning: Én løkke, du kan kalde din egen. Synd, at det er den eneste.",
    },
    f"{GAME}:loops:2": {
        "image": "badges/ouroboros.png",
        "track": "loops",
        "tier": 2,
        "name": "Ouroboros",
        "snark": "To løkker, begge åbne, begge på kryds. Du spiser dig selv i stereo, og systemets AI håber høfligt, at du har en plan. Det tror den ikke, du har. Se dig lige: en cirkel af ren selvforkælelse.",
        "reward": "Belønning: En hat af gyldne slangeskæl. Den passer desværre.",
    },
    f"{GAME}:loops:3": {
        "image": "badges/jormungandr.png",
        "track": "loops",
        "tier": 3,
        "name": "Midgårdsormen",
        "snark": "Tre løkker. Du har viklet hele banen om dig som et halstørklæde på en slange, der burde vide bedre. Midgård skælver. Guderne samles. Systemets AI er blevet tavs. Det er aldrig sket før. Vi er fulde af ærefrygt. Du er Ragnarok, og det klæder dig.",
        "reward": "Belønning: Midgårdsormens ring. Tag den på, og havet rejser sig for at møde dig.",
    },
}


def tier_for(achievement_id):
    """The catalogue entry for an id, or None if the id is unknown."""
    return CATALOG.get(achievement_id)


def highest_tiers(achievement_ids):
    """Keep only the highest reached tier per track, in catalogue order."""
    best = {}
    for aid in achievement_ids:
        entry = tier_for(aid)
        if entry is None:
            continue
        current = best.get(entry["track"])
        if current is None or entry["tier"] > CATALOG[current]["tier"]:
            best[entry["track"]] = aid
    return [aid for aid in CATALOG if aid in best.values()]
