import random
from itertools import chain
import json
import datetime
import yaml

from storage import match_file_path


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
            return yaml.safe_load(f)
    
    def get_eligible_names(self, gift_giver, already_taken=None):
        forbidden = (already_taken or []) + self.previous[gift_giver]
        for couple in self.couples:
            if gift_giver in couple:
                # or to your spouse or yourself
                forbidden += list(couple)
        return self.names - set(forbidden)
    
        
    def draw(self):
        for i in range(32):
            print(f"Try #{i+1}...")
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
                # if we get to this line, we are good
                print("Success!")
                self.config = secret_santa_config
                return

        raise Exception("No solution found!")

    @property
    def fname(self):
        return f"secret-santa-{self.year}.json"

    @property
    def file_path(self):
        return match_file_path(self.year, data_dir=self.data_dir)

    def save(self):
        with open(self.file_path, "w") as f:
            json.dump(self.config, f)
            
    def load(self):
        with open(self.file_path, "r") as f:
            self.config = json.load(f)
