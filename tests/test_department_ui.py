"""Structural regression checks for the deployed React factory application."""
from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class FactoryStructureTests(unittest.TestCase):
    def test_ten_active_departments_and_split_workshop(self):
        source = (WEB / "src/catalog.ts").read_text(encoding="utf-8")
        match = re.search(
            r"export const DEPARTMENTS: Department\[\] = (\[[\s\S]*?\])\s*"
            r"export const FEATURE_NAMES",
            source,
        )
        self.assertIsNotNone(match)
        departments = json.loads(match.group(1))
        ids = [department["id"] for department in departments]
        self.assertEqual(len(ids), 10)
        self.assertEqual(len(set(ids)), 10)
        self.assertNotIn("engineering", ids)
        self.assertNotIn("ehs", ids)
        workshop = next(dept for dept in departments if dept["id"] == "production")
        self.assertIn("tasks", workshop["features"])
        self.assertIn("nonProductionTasks", workshop["features"])

    def test_react_is_sole_published_shell(self):
        self.assertFalse((ROOT / "index.html").exists())
        self.assertFalse((ROOT / "app.js").exists())
        self.assertFalse((WEB / "src/LegacyFrame.tsx").exists())
        build = (WEB / "scripts/prepare-legacy.mjs").read_text(encoding="utf-8")
        self.assertIn('"access.js"', build)
        self.assertIn('"operations.js"', build)
        self.assertIn('"procurement.js"', build)
        self.assertNotIn("legacy-bridge", build)
        self.assertNotIn('copyFile(path.join(sourceDir, "index.html")', build)

    def test_actual_business_engines_still_loaded(self):
        runtime = (WEB / "src/business/runtime.ts").read_text(encoding="utf-8")
        for name in ("operations.js", "gantt.js", "modules.js",
                     "flow-ui.js", "procurement.js"):
            self.assertIn(name, runtime)
            self.assertTrue((ROOT / name).is_file(), name)
        self.assertIn("NativeBusiness", (WEB / "src/App.tsx").read_text(encoding="utf-8"))

    def test_scheduling_config_has_only_two_qaqc_tasks(self):
        config = json.loads((WEB / "src/scheduling-definitions.json").read_text(encoding="utf-8"))
        self.assertEqual(len(config["lanes"]), 5)
        self.assertEqual(len(config["stages"]), 6)
        self.assertEqual(
            [name for name in config["stages"] if "QAQC" in name],
            ["半成品 QAQC", "成品 QAQC"],
        )
        self.assertEqual(
            set(config["stages"]), set(config["categories"]),
        )
        gantt = (ROOT / "gantt.js").read_text(encoding="utf-8")
        overview = (WEB / "src/overview-gantt-layout.ts").read_text(encoding="utf-8")
        self.assertIn("FactorySchedulingConfig", gantt)
        self.assertIn("scheduling-definitions.json", overview)

    def test_legacy_css_is_still_scoped_for_business_forms(self):
        script = (WEB / "scripts/scope-legacy-css.mjs").read_text(encoding="utf-8")
        for name in ("operations.css", "modules.css", "gantt.css",
                     "flow-ui.css", "procurement.css"):
            self.assertIn(name, script)
            self.assertTrue((ROOT / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
