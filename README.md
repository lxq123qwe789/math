# 概率统计教学互动系统

完整的web应用系统，用于展示两个骰子点数之和的分布规律。

## 🎯 项目特点

- **学生端数据录入**：2-12每个数字对应的+1/-1按钮
- **实时可视化**：柱状图展示分布，支持A/B组颜色区分
- **防错机制**：次数上限限制（20次）、不可为负数
- **实时更新**：2秒自动刷新数据
- **教师端监控**（开发中）：班级监控面板、大数据模拟器

## 📋 系统要求

- Python 3.8+
- Node.js 16+
- PostgreSQL 12+

## 🛠️ 技术栈

### 后端
- FastAPI - 高性能异步web框架
- SQLAlchemy - ORM
- PostgreSQL - 数据库
- Socket.IO - 实时通信（预留）

### 前端
- Vue.js 3 - 前端框架
- ECharts - 数据可视化
- Vite - 构建工具
- Tailwind CSS - 样式框架

## 📦 安装与运行

### 一键启动（Windows）

在项目根目录双击运行 `start_all.bat`，或在 PowerShell 执行：

```powershell
./start_all.ps1
```

脚本会自动：
- 在 `math` 环境启动后端（`python -s -m uvicorn app:app --reload`）
- 启动前端开发服务器（`npm run dev`）

### 一键停止（Windows）

在项目根目录双击运行 `stop_all.bat`，或在 PowerShell 执行：

```powershell
./stop_all.ps1
```

脚本会结束监听端口 `8000`（后端）和 `5173`（前端）的进程。

### 1. 后端设置

```bash
# 进入backend目录
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置数据库（修改 config.py 中的 DATABASE_URL）
# 默认连接字符串: postgresql://postgres:123456@localhost:5432/math_teaching

# 运行服务器
python app.py
```

后端将在 `http://localhost:8000` 运行

### 2. 前端设置

```bash
# 进入frontend目录
cd frontend

# 安装依赖
npm install

# 开发服务器
npm run dev

# 生产构建
npm run build
```

前端将在 `http://localhost:5173` 运行

## 🔐 默认账号

### 学生账号
- 用户名: 202601 - 202608
- 密码: 12345678

### 教师账号
- 用户名: admin
- 密码: admin123

## 📋 API 文档

### 学生端 API

#### 更新数据记录
```
POST /api/student/update?group_id={group_id}&number={number}&action={action}
```

**参数**:
- `group_id` (int): 组ID
- `number` (int): 点数 (2-12)
- `action` (str): "increment" 或 "decrement"

**响应**:
```json
{
  "success": true,
  "number": 5,
  "count": 10,
  "message": "Number 5 updated to 10"
}
```

#### 获取组数据
```
GET /api/student/group/{group_id}/data
```

**响应**:
```json
{
  "group_id": 1,
  "group_name": "202601",
  "records": [
    {"number": 2, "count": 5},
    {"number": 3, "count": 3},
    ...
  ],
  "group_a_total": 45,
  "group_b_total": 32,
  "winner": "A"
}
```

#### 重置组数据
```
POST /api/student/group/{group_id}/reset
```

**响应**:
```json
{
  "success": true,
  "message": "Group 1 data has been reset"
}
```

### 认证 API

#### 登录
```
POST /api/auth/login
```

**请求体**:
```json
{
  "username": "202601",
  "password": "12345678"
}
```

**响应**:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user_id": 1,
  "username": "202601",
  "role": "student"
}
```

## 📊 数据模型

### 用户表 (users)
- id: 主键
- username: 用户名（唯一）
- password: 密码哈希
- role: 角色 ("admin" 或 "student")
- group_id: 组ID外键

### 组表 (groups)
- id: 主键
- name: 组名 (202601-202608)
- created_at: 创建时间

### 记录表 (records)
- id: 主键
- group_id: 组ID外键
- user_id: 用户ID外键
- number: 点数 (2-12)
- count: 计数
- created_at: 创建时间
- updated_at: 更新时间

## ✨ 学生端功能详解

### 1. 数据输入面板
- left侧展示2-12每个数字的输入控件
- +1按钮：增加计数（达到20时禁用）
- -1按钮：减少计数（计数为0时禁用）
- 实时显示当前计数和上限

### 2. 可视化图表
- 柱状图展示各点数的计数分布
- A组(5-9): 黄色 (#FFD700)
- B组(2-4、10-12): 蓝色 (#3b82f6)
- 每个柱子顶部实时显示计数值

### 3. 统计信息
- A组总计: 5、6、7、8、9的计数之和
- B组总计: 2、3、4、10、11、12的计数之和
- 实时显示获胜组别(A/B/平局)

### 4. 自动刷新
- 每2秒自动从服务器获取最新数据
- 确保多个用户之间的实时同步

## 🚀 下一步开发计划

- [ ] WebSocket实时推送（提高响应速度）
- [ ] 教师端班级监控面板
- [ ] 大数据模拟器
- [ ] 数据导出功能
- [ ] 用户权限管理完善
- [ ] 单元测试

## 📝 项目结构

```
math/
├── backend/
│   ├── app.py                 # FastAPI主应用
│   ├── config.py              # 配置文件
│   ├── requirements.txt        # Python依赖
│   ├── models/
│   │   └── database.py         # 数据库模型
│   └── routes/
│       └── student.py          # 学生端API
├── frontend/
│   ├── index.html              # HTML入口
│   ├── package.json            # npm配置
│   ├── vite.config.js          # Vite配置
│   ├── src/
│   │   ├── main.js             # Vue入口
│   │   ├── App.vue             # 根组件（登录/路由）
│   │   ├── style.css           # 全局样式
│   │   └── components/
│   │       └── StudentPanel.vue # 学生面板
│   └── public/                 # 静态资源
└── README.md                  # 本文件
```

## 📧 技术支持

如有问题，请检查：
1. PostgreSQL 是否正常运行
2. 数据库连接字符串是否正确
3. 前后端端口是否正确配置
4. 浏览器控制台错误信息

## 📄 许可证

MIT License
