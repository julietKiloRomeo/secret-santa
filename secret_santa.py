import random
from itertools import chain
import json
import datetime
import os
import yaml

from storage import decode_draw, encode_draw, match_file_path, ensure_match_file


class SecretSanta:

    def __init__(self, year=None, data_dir=None):
        self.year = year or datetime.datetime.now().year
        self.data_dir = data_dir
        self.config = None
        self.couples = self.load_couples()
        self.previous = self.load_previous()

        self.names = set(chain.from_iterable(self.couples))
        
    def load_couples(self):
        with open("couples.yaml", "r") as f:
            return yaml.safe_load(f)
    def load_previous(self):
        with open("previous.yaml", "r") as f:
            previous = yaml.safe_load(f)
        # Also exclude the last two years' actual draws, if we have them.
        for year in (self.year - 1, self.year - 2):
            path = ensure_match_file(year, data_dir=self.data_dir)
            if os.path.exists(path):
                with open(path) as f:
                    for giver, receiver in json.load(f).items():
                        previous.setdefault(giver, []).append(receiver)
        return previous
    
    def get_eligible_names(self, gift_giver, already_taken=None):
        forbidden = (already_taken or []) + self.previous[gift_giver]
        for couple in self.couples:
            if gift_giver in couple:
                # or to your spouse or yourself
                forbidden += list(couple)
        return self.names - set(forbidden)
    
        
    def draw(self):
        for _ in range(1000):
            try:
                # a mapping of who gives to whom. Empty for now        
                secret_santa_config = {}
                # now each name will be assigned someone to buy for
                for name in self.names:
                    eligible_names = self.get_eligible_names(name, already_taken=list(secret_santa_config.values()))
                    # pick a random name that is left
                    secret_santa_config[name] = random.choice(list(eligible_names))
            except Exception:
                # it might fail - then just try again
                pass
            else:
                # if it worked, then stop retrying
                # let's make sure we got it right...
                everyone_is_giving = set(secret_santa_config.keys()) == self.names
                everyone_is_receiving = set(secret_santa_config.values()) == self.names
                assert everyone_is_giving and everyone_is_receiving
                self.config = secret_santa_config
                return

        raise Exception("No solution found!")

    @property
    def file_path(self):
        return match_file_path(self.year, data_dir=self.data_dir)

    @property
    def encoded_path(self):
        return self.file_path[: -len(".json")] + ".enc"

    def violations(self, config):
        """Return rule breaks for a draw; an empty list means it is valid."""
        problems = []
        if set(config) != self.names or set(config.values()) != self.names:
            problems.append("not a one-to-one draw of every name")
        partner = {b: a for a, b in self.couples} | {a: b for a, b in self.couples}
        for giver, receiver in config.items():
            if giver == receiver:
                problems.append(f"self: {giver}")
            if partner.get(giver) == receiver:
                problems.append(f"spouse: {giver} -> {receiver}")
            if receiver in self.previous.get(giver, []):
                problems.append(f"repeat: {giver} -> {receiver}")
        return problems

    def save(self):
        with open(self.file_path, "w") as f:
            json.dump(self.config, f)
        with open(self.encoded_path, "w") as f:
            f.write(encode_draw(self.config))

    def load(self):
        for enc in (self.encoded_path, os.path.join(os.getcwd(), os.path.basename(self.encoded_path))):
            if os.path.exists(enc):
                with open(enc) as f:
                    self.config = decode_draw(f.read())
                return
        resolved = ensure_match_file(self.year, data_dir=self.data_dir)
        with open(resolved, "r") as f:
            self.config = json.load(f)
