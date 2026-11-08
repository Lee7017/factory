"""部门合并与玻璃主题的静态回归检查（不依赖浏览器或第三方库）。"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DepartmentUiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "app.js").read_text(encoding="utf-8")
        cls.access = (ROOT / "access.js").read_text(encoding="utf-8")
        cls.index = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.theme = (ROOT / "ui-theme.css").read_text(encoding="utf-8")
        cls.operations = (ROOT / "operations.js").read_text(encoding="utf-8")
        cls.modules = (ROOT / "modules.js").read_text(encoding="utf-8")

    def test_eleven_departments_and_merged_it(self):
        source = self.app.split("const departments=[", 1)[1].split("];", 1)[0]
        ids = re.findall(r"\{id:'(\w+)',name:", source)
        self.assertEqual(len(ids), 11)
        self.assertIn("it", ids)
        self.assertNotIn("tech", ids)
        self.assertNotIn("ehs", ids)
        self.assertIn("name:'信息化部'", source)
        self.assertNotIn("safety:'EHS 安全检查'", self.app)
        self.assertIn("features:['permissions','employees','settings','productSettings','dictionarySettings','catalog','sop','sopExecutions','templates','bom']", source)

    def test_all_business_features_have_own_svg(self):
        feature_line = next(line for line in self.app.splitlines()
                            if line.startswith("const features="))
        feature_keys = set(re.findall(r"(?:\{|,)([A-Za-z]+):'", feature_line))
        svg_names = re.findall(r'id="ic-feature-([A-Za-z]+)"', self.index)
        self.assertEqual(len(svg_names), len(set(svg_names)))
        self.assertEqual(set(svg_names), feature_keys)
        self.assertIn("icon('feature-'+f)", self.app)

    def test_merged_permissions_and_routes(self):
        self.assertIn("dept:'it',features:['it.sop'", self.access)
        self.assertIn("mergedTechIntoItV1", self.access)
        self.assertIn("permitted('it','sop','execute')", self.modules)
        self.assertIn("['it','bom','edit']", self.operations)
        self.assertNotIn("case 'safety':", self.operations)

    def test_compact_desktop_density_without_page_zoom(self):
        desktop = self.theme.split("/* V24 · 80% desktop density.", 1)[1]
        self.assertIn("@media (min-width:861px)", desktop)
        self.assertIn(".sidebar{width:240px;flex:0 0 240px}", desktop)
        self.assertIn(".main-content{max-width:1250px;padding:25px 25px 32px}", desktop)
        self.assertIn("min-height:142px", desktop)
        self.assertIn("width:46px;height:46px", desktop)
        self.assertNotRegex(desktop, r"(?<![\\w-])zoom\\s*:")
        self.assertNotIn("scale(0.8)", desktop)

    def test_home_overview_is_first_square_tile_and_search_removed(self):
        self.assertNotIn('class="nav-label"', self.index)
        self.assertNotIn('class="nav-search"', self.index)
        self.assertNotIn('id="dept-search"', self.index)
        self.assertNotIn("getElementById('dept-search')", self.app)
        self.assertIn('data-nav-home', self.app)
        self.assertIn("icon('feature-overview')", self.app)
        self.assertIn("<strong>首页总览</strong>", self.app)
        self.assertIn("node.innerHTML=home+tiles;", self.app)
        self.assertIn("if(homeTile){openHome();return;}", self.app)
        self.assertIn('class="dept-row', self.app)

    def test_square_grid_and_visible_glass(self):
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", self.theme)
        self.assertIn("aspect-ratio:1/1", self.theme)
        self.assertIn("backdrop-filter:blur(20px)", self.theme)
        self.assertIn("rgba(63,165,105,.38)", self.theme)
        self.assertIn("功能按部门及岗位权限开放", self.index)


if __name__ == "__main__":
    unittest.main()
