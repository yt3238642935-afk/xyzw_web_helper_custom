import * as XLSX from "xlsx-js-style";


/* =========================================================
 * 基础布局
 *
 * 每行 5 个资源
 * 每个资源占两列：
 *
 * 名称 | 数值
 *
 * 因此总共 10 列。
 * ========================================================= */

const ITEMS_PER_ROW = 5;
const GROUP_WIDTH = 2;
const TOTAL_COLS = ITEMS_PER_ROW * GROUP_WIDTH;


/* =========================================================
 * 配色
 * ========================================================= */

const COLORS = {
  // 标题
  primary: "3273E8",
  titleText: "FFFFFF",

  // 角色基础信息
  metaBg: "C5E7ED",
  metaText: "111827",

  // 资源
  resourceLabelBg: "F6F8FA",
  resourceValueBg: "FFFFFF",

  resourceLabelText: "3F4B5A",
  resourceValueText: "172033",

  // 表格
  border: "D7DEE7",

  tableHeader: "3273E8",
  tableHeaderText: "FFFFFF",

  altRow: "F8FAFC",
  white: "FFFFFF",

  zeroText: "6B7280",
};


/* =========================================================
 * 通用边框
 * ========================================================= */

const thinBorder = {
  style: "thin",
  color: {
    rgb: COLORS.border,
  },
};


/* =========================================================
 * 身份牌标题样式
 * ========================================================= */

const roleTitleStyle = {
  fill: {
    patternType: "solid",
    fgColor: {
      rgb: COLORS.primary,
    },
  },

  font: {
    name: "Microsoft YaHei",
    bold: true,
    color: {
      rgb: COLORS.titleText,
    },
    sz: 16,
  },

  alignment: {
    vertical: "center",
    horizontal: "center",
  },

  border: {
    bottom: thinBorder,
  },
};


/* =========================================================
 * Token / 服务器 / 角色ID 样式
 * ========================================================= */

const metaStyle = {
  fill: {
    patternType: "solid",
    fgColor: {
      rgb: COLORS.metaBg,
    },
  },

  font: {
    name: "Microsoft YaHei",
    color: {
      rgb: COLORS.metaText,
    },
    sz: 13,
  },

  alignment: {
    vertical: "center",
    horizontal: "center",
  },

  border: {
    top: thinBorder,
    bottom: thinBorder,
  },
};


/* =========================================================
 * 资源名称
 * ========================================================= */

const resourceLabelStyle = {
  fill: {
    patternType: "solid",
    fgColor: {
      rgb: COLORS.resourceLabelBg,
    },
  },

  font: {
    name: "Microsoft YaHei",
    color: {
      rgb: COLORS.resourceLabelText,
    },
    sz: 11,
  },

  alignment: {
    vertical: "center",
    horizontal: "center",
  },

  border: {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
  },
};


/* =========================================================
 * 资源数量
 * ========================================================= */

const resourceValueStyle = {
  fill: {
    patternType: "solid",
    fgColor: {
      rgb: COLORS.resourceValueBg,
    },
  },

  font: {
    name: "Microsoft YaHei",
    bold: true,
    color: {
      rgb: COLORS.resourceValueText,
    },
    sz: 11,
  },

  alignment: {
    vertical: "center",
    horizontal: "center",
  },

  border: {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
  },
};


/* =========================================================
 * 0 值
 * ========================================================= */

const zeroValueStyle = {
  ...resourceValueStyle,

  font: {
    name: "Microsoft YaHei",
    bold: true,
    color: {
      rgb: COLORS.zeroText,
    },
    sz: 11,
  },
};


/* =========================================================
 * 万 / 亿格式
 *
 * 19094000  -> 1909.4万
 * 42000     -> 4.2万
 * 8543      -> 8,543
 * 22777000  -> 2277.7万
 * 123456789 -> 1.2亿
 * ========================================================= */

export function formatCompactNumber(value) {
  const num = Number(value ?? 0);

  if (!Number.isFinite(num)) {
    return value ?? "";
  }

  if (num === 0) {
    return "0";
  }

  const abs = Math.abs(num);

  if (abs >= 100_000_000) {
    return `${removeTailZero(num / 100_000_000)}亿`;
  }

  if (abs >= 10_000) {
    return `${removeTailZero(num / 10_000)}万`;
  }

  return num.toLocaleString("zh-CN");
}


function removeTailZero(num) {
  return Number(
    num.toFixed(1)
  ).toString();
}


/* =========================================================
 * 角色基础字段
 * ========================================================= */

const META_KEYS = new Set([
  "Token名称",
  "Token",
  "tokenName",

  "服务器",
  "server",

  "角色ID",
  "roleId",

  "角色名",
  "name",
  "roleName",

  "等级",
  "level",

  "战力",
  "power",

  "身份等级",
  "legacy",

  "头像",
  "headImg",
]);


function getValue(
  role,
  keys,
  fallback = ""
) {
  for (const key of keys) {
    if (
      role[key] !== undefined &&
      role[key] !== null
    ) {
      return role[key];
    }
  }

  return fallback;
}


function getRoleName(role) {
  return getValue(
    role,
    [
      "角色名",
      "roleName",
      "name",
    ],
    "未知角色"
  );
}


function getRoleId(role) {
  return getValue(
    role,
    [
      "角色ID",
      "roleId",
    ],
    ""
  );
}


function getLevel(role) {
  return Number(
    getValue(
      role,
      [
        "等级",
        "level",
      ],
      0
    )
  );
}


function getPower(role) {
  return Number(
    getValue(
      role,
      [
        "战力",
        "power",
      ],
      0
    )
  );
}


function getLegacy(role) {
  return getValue(
    role,
    [
      "身份等级",
      "legacy",
    ],
    0
  );
}


function getTokenName(role) {
  return getValue(
    role,
    [
      "Token名称",
      "Token",
      "tokenName",
    ],
    ""
  );
}


function getServer(role) {
  return getValue(
    role,
    [
      "服务器",
      "server",
    ],
    ""
  );
}


/* =========================================================
 * 提取资源
 * ========================================================= */

function getResources(role) {
  return Object
    .entries(role)

    .filter(([key, value]) => {
      if (META_KEYS.has(key)) {
        return false;
      }

      if (
        String(key).startsWith("_")
      ) {
        return false;
      }

      return (
        typeof value === "number" ||
        typeof value === "string"
      );
    })

    .map(([label, value]) => {
      const numericValue =
        Number(value);

      const isNumber =
        Number.isFinite(
          numericValue
        );

      return {
        label,

        raw: isNumber
          ? numericValue
          : value,

        display: isNumber
          ? formatCompactNumber(
              numericValue
            )
          : value,
      };
    });
}


/* =========================================================
 * Excel 单元格工具
 * ========================================================= */

function writeCell(
  worksheet,
  row,
  col,
  value,
  style = null
) {
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [[value]],
    {
      origin: {
        r: row,
        c: col,
      },
    }
  );

  const address =
    XLSX.utils.encode_cell({
      r: row,
      c: col,
    });

  if (
    worksheet[address] &&
    style
  ) {
    worksheet[address].s =
      style;
  }
}


function mergeCells(
  worksheet,
  startRow,
  startCol,
  endRow,
  endCol
) {
  worksheet["!merges"] ||= [];

  worksheet["!merges"].push({
    s: {
      r: startRow,
      c: startCol,
    },

    e: {
      r: endRow,
      c: endCol,
    },
  });
}


function setRowHeight(
  worksheet,
  row,
  height
) {
  worksheet["!rows"] ||= [];

  worksheet["!rows"][row] = {
    hpt: height,
  };
}


/* =========================================================
 * Sheet 1
 *
 * 身份牌总览
 *
 * 对应你最新截图的版式。
 * ========================================================= */

function createIdentityOverviewSheet(data) {
  const worksheet =
    XLSX.utils.aoa_to_sheet([
      [],
    ]);

  let currentRow = 0;


  data.forEach(
    (role, roleIndex) => {

      const roleName =
        getRoleName(role);

      const roleId =
        getRoleId(role);

      const level =
        getLevel(role);

      const power =
        getPower(role);

      const legacy =
        getLegacy(role);

      const tokenName =
        getTokenName(role);

      const server =
        getServer(role);


      /* =====================================================
       * 第一行
       *
       * Q581-2   Lv.2507   战力 2277.7万
       * ===================================================== */

      const titleParts = [
        roleName,
        `Lv.${level}`,
        `战力 ${formatCompactNumber(power)}`,
      ];


      /*
       * 身份为 0 时不显示。
       *
       * 如果以后身份有实际值，则自动加入。
       */
      if (
        legacy !== "" &&
        Number(legacy) > 0
      ) {
        titleParts.push(
          `身份 ${legacy}`
        );
      }


      writeCell(
        worksheet,
        currentRow,
        0,
        titleParts.join("    "),
        roleTitleStyle
      );


      mergeCells(
        worksheet,
        currentRow,
        0,
        currentRow,
        TOTAL_COLS - 1
      );


      setRowHeight(
        worksheet,
        currentRow,
        28
      );


      currentRow++;


      /* =====================================================
       * 第二行
       *
       * Token       | 服务器       | 角色ID
       *
       * 10列分配：
       *
       * Token   0~3
       * Server  4~6
       * RoleID  7~9
       * ===================================================== */

      writeCell(
        worksheet,
        currentRow,
        0,
        `Token： ${tokenName}`,
        metaStyle
      );


      mergeCells(
        worksheet,
        currentRow,
        0,
        currentRow,
        3
      );


      writeCell(
        worksheet,
        currentRow,
        4,
        `服务器： ${server}`,
        metaStyle
      );


      mergeCells(
        worksheet,
        currentRow,
        4,
        currentRow,
        6
      );


      writeCell(
        worksheet,
        currentRow,
        7,
        `角色ID： ${roleId}`,
        metaStyle
      );


      mergeCells(
        worksheet,
        currentRow,
        7,
        currentRow,
        9
      );


      setRowHeight(
        worksheet,
        currentRow,
        26
      );


      currentRow++;


      /* =====================================================
       * 资源
       *
       * 无空行，直接开始。
       * ===================================================== */

      const resources =
        getResources(role);


      for (
        let i = 0;
        i < resources.length;
        i += ITEMS_PER_ROW
      ) {

        const rowItems =
          resources.slice(
            i,
            i + ITEMS_PER_ROW
          );


        rowItems.forEach(
          (resource, index) => {

            const labelCol =
              index * GROUP_WIDTH;

            const valueCol =
              labelCol + 1;


            /* ---------- 名称 ---------- */

            writeCell(
              worksheet,
              currentRow,
              labelCol,
              resource.label,
              resourceLabelStyle
            );


            /* ---------- 数量 ---------- */

            const numericValue =
              Number(resource.raw);


            const style =
              Number.isFinite(
                numericValue
              ) &&
              numericValue === 0
                ? zeroValueStyle
                : resourceValueStyle;


            writeCell(
              worksheet,
              currentRow,
              valueCol,
              resource.display,
              style
            );

          }
        );


        /*
         * 如果最后一行不足 5 个资源，
         * 仍然给剩余单元格添加边框，
         * 保证版式完整。
         */
        for (
          let index =
            rowItems.length;
          index < ITEMS_PER_ROW;
          index++
        ) {

          const labelCol =
            index * GROUP_WIDTH;

          const valueCol =
            labelCol + 1;


          writeCell(
            worksheet,
            currentRow,
            labelCol,
            "",
            resourceLabelStyle
          );


          writeCell(
            worksheet,
            currentRow,
            valueCol,
            "",
            resourceValueStyle
          );

        }


        setRowHeight(
          worksheet,
          currentRow,
          24
        );


        currentRow++;
      }


      /* =====================================================
       * 角色之间仅保留 1 行空行
       * ===================================================== */

      if (
        roleIndex <
        data.length - 1
      ) {
        setRowHeight(
          worksheet,
          currentRow,
          13
        );

        currentRow++;
      }

    }
  );


  /* =========================================================
   * 列宽
   *
   * 5组：
   *
   * 名称 | 数量
   * ========================================================= */

  worksheet["!cols"] = [

    // 第一组
    { wch: 13 },
    { wch: 10 },

    // 第二组
    { wch: 13 },
    { wch: 10 },

    // 第三组
    { wch: 13 },
    { wch: 10 },

    // 第四组
    { wch: 13 },
    { wch: 10 },

    // 第五组
    { wch: 13 },
    { wch: 10 },

  ];


  /* =========================================================
   * 隐藏网格线
   * ========================================================= */

  worksheet["!sheetViews"] = [
    {
      showGridLines: false,
    },
  ];


  /* =========================================================
   * 页面设置
   * ========================================================= */

  worksheet["!pageSetup"] = {
    orientation: "landscape",
    fitToWidth: 1,
    fitToHeight: 0,
  };


  return worksheet;
}


/* =========================================================
 * Sheet 2
 *
 * 角色数据表
 *
 * 一行 = 一个角色
 * 一列 = 一个字段
 *
 * 全部保存原始数字。
 * ========================================================= */

function createRoleTableSheet(data) {
  if (!data.length) {
    return XLSX.utils.aoa_to_sheet(
      []
    );
  }


  /* =====================================================
   * 收集所有资源字段
   * ===================================================== */

  const resourceNameSet =
    new Set();


  data.forEach(
    (role) => {

      getResources(role).forEach(
        (resource) => {

          resourceNameSet.add(
            resource.label
          );

        }
      );

    }
  );


  const resourceNames =
    Array.from(
      resourceNameSet
    );


  /* =====================================================
   * 每个角色变成一行
   * ===================================================== */

  const rows =
    data.map(
      (role) => {

        const resourceMap = {};


        getResources(role).forEach(
          (resource) => {

            resourceMap[
              resource.label
            ] = resource.raw;

          }
        );


        const row = {

          角色名:
            getRoleName(role),

          角色ID:
            getRoleId(role),

          Token:
            getTokenName(role),

          服务器:
            getServer(role),

          等级:
            getLevel(role),

          战力:
            getPower(role),

          身份:
            getLegacy(role),

        };


        resourceNames.forEach(
          (name) => {

            row[name] =
              resourceMap[name] ?? 0;

          }
        );


        return row;

      }
    );


  const worksheet =
    XLSX.utils.json_to_sheet(
      rows
    );


  styleNormalTable(
    worksheet
  );


  return worksheet;
}


/* =========================================================
 * Sheet 3
 *
 * 资源长表
 *
 * 一行 = 一个角色的一个资源
 * ========================================================= */

function createResourceLongSheet(data) {
  const rows = [];


  data.forEach(
    (role) => {

      const common = {

        角色名:
          getRoleName(role),

        角色ID:
          getRoleId(role),

        Token:
          getTokenName(role),

        服务器:
          getServer(role),

        等级:
          getLevel(role),

        战力:
          getPower(role),

      };


      getResources(role).forEach(
        (resource) => {

          rows.push({

            ...common,

            资源:
              resource.label,

            数量:
              resource.raw,

            显示值:
              resource.display,

          });

        }
      );

    }
  );


  const worksheet =
    XLSX.utils.json_to_sheet(
      rows
    );


  styleNormalTable(
    worksheet
  );


  return worksheet;
}


/* =========================================================
 * 普通数据表样式
 * ========================================================= */

function styleNormalTable(
  worksheet
) {

  if (!worksheet["!ref"]) {
    return;
  }


  const range =
    XLSX.utils.decode_range(
      worksheet["!ref"]
    );


  /* =====================================================
   * 表头
   * ===================================================== */

  for (
    let col = range.s.c;
    col <= range.e.c;
    col++
  ) {

    const address =
      XLSX.utils.encode_cell({
        r: 0,
        c: col,
      });


    if (!worksheet[address]) {
      continue;
    }


    worksheet[address].s = {

      fill: {
        patternType: "solid",

        fgColor: {
          rgb:
            COLORS.tableHeader,
        },
      },

      font: {
        name:
          "Microsoft YaHei",

        color: {
          rgb:
            COLORS.tableHeaderText,
        },

        bold: true,
      },

      alignment: {
        horizontal: "center",
        vertical: "center",
      },

      border: {
        top: thinBorder,
        bottom: thinBorder,
        left: thinBorder,
        right: thinBorder,
      },

    };

  }


  /* =====================================================
   * 数据区域
   * ===================================================== */

  for (
    let row = 1;
    row <= range.e.r;
    row++
  ) {

    for (
      let col = range.s.c;
      col <= range.e.c;
      col++
    ) {

      const address =
        XLSX.utils.encode_cell({
          r: row,
          c: col,
        });


      const cell =
        worksheet[address];


      if (!cell) {
        continue;
      }


      cell.s = {

        fill: {
          patternType: "solid",

          fgColor: {
            rgb:
              row % 2 === 0
                ? COLORS.altRow
                : COLORS.white,
          },
        },

        font: {
          name:
            "Microsoft YaHei",

          sz: 10,
        },

        alignment: {
          vertical: "center",

          horizontal:
            typeof cell.v ===
            "number"
              ? "right"
              : "left",
        },

        border: {
          bottom:
            thinBorder,
        },

      };


      /* =================================================
       * 关键：
       *
       * 这里仅修改 Excel 显示格式，
       * 实际值仍然是 number。
       *
       * 所以 SUM / 排序 / pandas 都正常。
       * ================================================= */

      if (
        typeof cell.v ===
        "number"
      ) {

        cell.z =
          "#,##0";

      }

    }

  }


  /* =====================================================
   * 筛选
   * ===================================================== */

  worksheet["!autofilter"] = {
    ref: worksheet["!ref"],
  };


  /* =====================================================
   * 表头高度
   * ===================================================== */

  worksheet["!rows"] ||= [];

  worksheet["!rows"][0] = {
    hpt: 25,
  };


  /* =====================================================
   * 自动列宽
   * ===================================================== */

  const widths = [];


  for (
    let col = range.s.c;
    col <= range.e.c;
    col++
  ) {

    let maxLength = 8;


    for (
      let row = range.s.r;
      row <= range.e.r;
      row++
    ) {

      const address =
        XLSX.utils.encode_cell({
          r: row,
          c: col,
        });


      const value =
        worksheet[address]?.v;


      if (
        value === undefined ||
        value === null
      ) {
        continue;
      }


      maxLength =
        Math.max(
          maxLength,
          String(value).length
        );

    }


    widths.push({
      wch:
        Math.min(
          Math.max(
            maxLength + 2,
            10
          ),
          22
        ),
    });

  }


  worksheet["!cols"] =
    widths;


  worksheet["!sheetViews"] = [
    {
      showGridLines: false,
    },
  ];

}


/* =========================================================
 * 导出入口
 * ========================================================= */

export function exportIdentityExcel(data) {

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {

    throw new Error(
      "没有可导出的角色数据"
    );

  }


  const workbook =
    XLSX.utils.book_new();


  /* =====================================================
   * Sheet 1
   *
   * 人工查看
   * ===================================================== */

  XLSX.utils.book_append_sheet(
    workbook,

    createIdentityOverviewSheet(
      data
    ),

    "身份牌总览"
  );


  /* =====================================================
   * Sheet 2
   *
   * 一角色一行
   * Excel / pandas 最常用
   * ===================================================== */

  XLSX.utils.book_append_sheet(
    workbook,

    createRoleTableSheet(
      data
    ),

    "角色数据表"
  );


  /* =====================================================
   * Sheet 3
   *
   * 长表分析
   * ===================================================== */

  XLSX.utils.book_append_sheet(
    workbook,

    createResourceLongSheet(
      data
    ),

    "资源长表"
  );


  /* =====================================================
   * 文件名
   * ===================================================== */

  const now =
    new Date();


  const date =
    [
      now.getFullYear(),

      String(
        now.getMonth() + 1
      ).padStart(
        2,
        "0"
      ),

      String(
        now.getDate()
      ).padStart(
        2,
        "0"
      ),
    ].join("-");


  const time =
    [
      String(
        now.getHours()
      ).padStart(
        2,
        "0"
      ),

      String(
        now.getMinutes()
      ).padStart(
        2,
        "0"
      ),
    ].join("");


  XLSX.writeFile(
    workbook,

    `角色身份牌_${date}_${time}.xlsx`,

    {
      bookType: "xlsx",
      compression: true,
      cellStyles: true,
    }
  );
}
