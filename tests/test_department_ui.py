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

    def test_department_roster_contains_office_location(self):
        self.assertIn("tab('members','部门花名簿',members.length)", self.app)
        self.assertIn("<strong>部门花名簿</strong>", self.app)
        self.assertIn('class="dept-roster-office"', self.app)
        self.assertEqual(self.app.count('class="office-location"'), 1)
        self.assertIn('data-action="editOffice"', self.app)
        self.assertIn("if(op==='saveOffice')", self.app)
        self.assertIn(".dept-roster-office .office-location", self.theme)
        self.assertNotIn('<div class="dept-hub"><div class="office-location"', self.app)
        self.assertIn("20261108-dept-info-fix-v31", self.index)

    def test_sidebar_red_green_blend(self):
        sidebar = self.theme.split("/* V29 · 左侧栏也使用红绿底光", 1)[1]
        self.assertIn("rgba(85,170,116,.19)", sidebar)
        self.assertIn("rgba(214,95,109,.17)", sidebar)
        self.assertIn("rgba(255,255,255,.86)", sidebar)
        self.assertIn("backdrop-filter:blur(28px) saturate(150%)", sidebar)
        self.assertIn("@media(max-width:860px)", sidebar)
        self.assertIn("20261108-dept-info-fix-v31", self.index)

    def test_department_heading_moves_to_topbar(self):
        self.assertIn('id="ic-info"', self.index)
        self.assertIn('data-dept-info-toggle', self.app)
        self.assertIn('aria-expanded="false"', self.app)
        self.assertIn('id="dept-description-popover" class="dept-info-popover"', self.index)
        self.assertIn('class="dept-crumb-group"', self.app)
        self.assertIn("e(dept.description)", self.app)
        self.assertIn("classList.toggle('is-dept-home',!data.home&&!f)", self.app)
        self.assertIn(".main-content.is-dept-home .page-heading{display:none}", self.theme)
        self.assertIn("document.addEventListener('mouseover'", self.app)
        self.assertIn("document.addEventListener('mouseout'", self.app)
        self.assertIn(".dept-info-popover[hidden]{display:none!important}", self.theme)
        self.assertIn("if(ev.key!=='Escape')return;", self.app)
        self.assertIn("20261108-dept-info-fix-v31", self.index)

    def test_popup_is_detached_and_sidebar_has_clearer_depth(self):
        self.assertNotIn('title="部门介绍"', self.app)
        self.assertNotIn("dept-info-wrap", self.app)
        self.assertIn("position:fixed;z-index:90", self.theme)
        self.assertIn("white-space:normal;overflow-wrap:anywhere", self.theme)
        self.assertIn("pop.style.left=Math.max(12", self.app)
        self.assertIn("window.innerWidth-size.width-12", self.app)
        self.assertIn("window.innerHeight-size.height-12", self.app)
        self.assertIn("window.addEventListener('scroll',hideDeptInfo,true)", self.app)
        self.assertIn("window.addEventListener('resize',hideDeptInfo)", self.app)
        self.assertIn("background:rgba(255,255,255,.60)", self.theme)
        self.assertIn("background:rgba(255,255,255,.72)", self.theme)

    def test_square_grid_and_visible_glass(self):
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", self.theme)
        self.assertIn("aspect-ratio:1/1", self.theme)
        self.assertIn("backdrop-filter:blur(20px)", self.theme)
        self.assertIn("rgba(63,165,105,.38)", self.theme)
        self.assertIn("功能按部门及岗位权限开放", self.index)


if __name__ == "__main__":
    unittest.main()
