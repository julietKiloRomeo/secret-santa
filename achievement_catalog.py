"""Achievement catalogue for player cards. Texts agreed in plans/todo/006.

Ids are "<game>:<track>:<tier>", with the server game id (advent-1 is Snake).
Each track has three tiers; a card shows only the highest reached tier per track.
"""

GAME = "advent-1"

CATALOG = {
    f"{GAME}:loops:1": {
        "image": "badges/nidhogg.png",
        "track": "loops",
        "tier": 1,
        "name": "Nidhogg",
        "snark": "You bit your own tail. On purpose. The System AI has opened a file titled 'Hobbies, Concerning.' Somewhere a dragon is taking notes.",
        "reward": "One loop you can call your own. Pity it is the only one.",
    },
    f"{GAME}:loops:2": {
        "image": "badges/ouroboros.png",
        "track": "loops",
        "tier": 2,
        "name": "Ouroboros",
        "snark": "Two loops, both open, both crossing. You are eating yourself in stereo, and the System AI is politely hoping you have a plan. It does not think you have a plan. Look at you, forming a circle of pure self-indulgence.",
        "reward": "A gold serpent-scale hat. It fits, unfortunately.",
    },
    f"{GAME}:loops:3": {
        "image": "badges/jormungandr.png",
        "track": "loops",
        "tier": 3,
        "name": "Jormungandr",
        "snark": "Three loops. You have wrapped the whole board around yourself like a scarf on a snake that should know better. Midgard is shaking. The gods are gathering. The System AI has stopped talking, which has never happened before. We are in awe. You are the end of days, and it suits you.",
        "reward": "The World Serpent's Ring. Wear it and the sea rises to meet you.",
    },
    f"{GAME}:shield:3": {
        "image": "badges/buckler.png",
        "track": "shield",
        "tier": 3,
        "name": "Buckler",
        "snark": "Three shields. You collect protection the way other snakes collect regret. The System AI says prepared. The System AI also says hoarder. It is taking bets.",
        "reward": "One Buckler, a small round shield with a rune that stings.",
    },
    f"{GAME}:shield:6": {
        "image": "badges/aegis.png",
        "track": "shield",
        "tier": 6,
        "name": "Aegis",
        "snark": "Six shields held at once. Insurance agents across the galaxy have started calling you back, and they are crying. You are no longer a snake. You are a fortress with a bad attitude.",
        "reward": "The Aegis, six shields gleaming. Try not to be smug about it.",
    },
    f"{GAME}:shield:10": {
        "image": "badges/aegishjalmur.png",
        "track": "shield",
        "tier": 10,
        "name": "Aegishjalmur",
        "snark": "Ten shields. The System AI has stopped reading the spreadsheet and is simply staring at you, with what can only be called reverence. Nothing can touch you. Nothing dares.",
        "reward": "The Helm of Awe. Every wall on the board feels a little less certain of itself.",
    },
    f"{GAME}:trim:3": {
        "image": "badges/snip-of-the-norns.png",
        "track": "trim",
        "tier": 3,
        "name": "Snip of the Norns",
        "snark": "Three cuts. Clean, polite, and deeply unnecessary. Your tail did not ask for this and is still in shock. The Norns are watching with very sharp scissors.",
        "reward": "The Snip, a pair of ribbon scissors. Decorate responsibly.",
    },
    f"{GAME}:trim:6": {
        "image": "badges/shears-of-atropos.png",
        "track": "trim",
        "tier": 6,
        "name": "Shears of Atropos",
        "snark": "Six trims. Your tail is a rumour now. Santa is asking where the ribbon went, and the elves have formed a committee. Atropos leans over your shoulder, impressed, which is terrifying.",
        "reward": "The Shears of Atropos. Do not hold them near anything you care about.",
    },
    f"{GAME}:trim:10": {
        "image": "badges/the-last-cut.png",
        "track": "trim",
        "tier": 10,
        "name": "The Last Cut",
        "snark": "Ten trims. The elves will be talking about this haircut for a decade. The Norns have closed their book, Atropos has put down her shears, and the System AI whispers, 'Well. Look at that.' We have no words. We are reverent. We are slightly afraid of you.",
        "reward": "The Last Cut. Not to be used on anything with a pulse.",
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
