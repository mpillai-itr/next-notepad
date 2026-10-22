import os

def load(path):
    with open(path) as fh:
        return fh.read().splitlines()

class Report:
    def render(self, rows):
        return "\n".join(sorted(set(rows)))

if __name__ == "__main__":
    print(Report().render(load("fruits.txt")))
