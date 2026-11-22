import runpy
import unittest
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request


module = runpy.run_path(str(Path(__file__).with_name("snapshot-the-lab.py")))
origin = module["ORIGIN"]


class SnapshotRedirectTest(unittest.TestCase):
    def redirect(self, destination):
        return module["PlatformRedirects"]().redirect_request(
            Request(origin + "/"), None, 302, "Found", {}, destination
        )

    def test_platform_redirect(self):
        self.assertEqual(self.redirect(origin + "/about").full_url, origin + "/about")

    def test_other_origins_are_refused_before_following(self):
        for url in ("https://other.example/", origin.replace("https:", "http:"), origin + ":8080/"):
            with self.subTest(url=url), self.assertRaises(URLError):
                self.redirect(url)


if __name__ == "__main__":
    unittest.main()
