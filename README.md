# 概率统计教学互动系统

完整的web应用系统，用于展示两个骰子点数之和的分布规律。

## 🎯 项目特点

- **学生端数据录入**：2-12每个数字对应的+1/-1按钮
- **实时可视化**：柱状图展示分布，支持A/B组颜色区分
- **防错机制**：每组总次数上限为20次，单项计数不可为负数
- **实时更新**：通过 Socket.IO 广播数据变化，学生端和教师端收到通知后刷新相关数据
- **教师端监控**：查看各组和班级汇总，并模拟大量骰子投掷

## 📋 系统要求

- Python 3.8+
- Node.js 16+
- PostgreSQL 12+

## 🛠️ 技术栈

### 后端
- FastAPI - 高性能异步web框架
- SQLAlchemy - ORM
- PostgreSQL - 数据库
- Socket.IO - 实时数据变化通知

### 前端
- Vue.js 3 - 前端框架
- ECharts - 数据可视化
- Vite - 构建工具
- Tailwind CSS - 样式框架

## 📦 安装与运行

### 一键启动（Windows）

直接运行 `start_all.bat` 即可。首次启动后端时，如果没有配置 `SECRET_KEY` 环境变量或 `backend/.env` 中的密钥，系统会自动生成随机密钥并写入 `backend/.env`；后续启动会复用该密钥，避免重启后已有 JWT 失效。该文件已加入 Git 忽略规则，不要手动删除或提交。

正式部署时应在服务器环境变量或密钥管理服务中配置 `SECRET_KEY`，并在所有后端实例间使用相同的密钥。不要在每次启动时轮换密钥。

脚本会自动：
- 在 `math` 环境启动后端（`python app.py`）
- 启动前端开发服务器（`npm run dev`）

### 一键停止（Windows）

在项目根目录双击运行 `stop_all.bat`，或在 PowerShell 执行：

```powershell
./stop_all.ps1
```

脚本会结束监听端口 `8000`（后端）和 `5173`（前端）的进程。

### 1. 后端设置

```powershell
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

本地开发时如果未配置 `SECRET_KEY`，系统会自动生成并写入 `backend/.env`。正式部署时应通过服务器环境变量或密钥管理服务配置至少32个字符的随机密钥，不要把密钥提交到代码仓库。每次启动时，系统只会补建缺失的默认小组和账号，不会重置已有账号密码或自动删除已有小组、用户和实验记录。

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

## 🐳 Docker 部署（Ubuntu）

项目提供 Docker Compose 部署配置：前端由 Nginx 提供静态文件并代理 `/api` 和 `/socket.io`，Caddy 作为入口代理；配置域名后 Caddy 会自动申请和续期 HTTPS 证书。后端和 PostgreSQL 不发布到公网，数据库使用 Docker 命名卷持久保存。

### 1. 准备域名和服务器端口

如需 HTTPS，先将域名的 A 记录指向服务器公网 IP。云服务器安全组至少放行 TCP 22（建议仅允许自己的 IP）、80 和 443。没有域名时，可先将 `.env` 中的 `DOMAIN` 保持为 `:80`，通过 HTTP 临时验证；正式对公网提供登录服务前应配置域名和 HTTPS。

### 2. 在 Ubuntu 安装 Docker

按 [Docker 官方 Ubuntu 安装指南](https://docs.docker.com/engine/install/ubuntu/) 安装 Docker Engine 和 Compose 插件。安装完成后确认 `docker compose version` 可用。

### 3. 获取代码并配置环境变量

在服务器将项目克隆到部署目录，然后进入项目根目录：

```bash
cp .env.example .env
```

编辑 `.env`，设置 `DOMAIN`、数据库名和数据库用户，并填入随机密码和 JWT 密钥。可以分别运行 `openssl rand -hex 24` 和 `openssl rand -hex 32` 生成密码与密钥，再把结果写入 `.env`。`SECRET_KEY` 至少需要 32 个字符。保护配置文件权限：

```bash
chmod 600 .env
```

`.env` 不要提交到 Git。Compose 会将其中的 `SECRET_KEY` 和数据库连接地址传给后端容器；容器间使用服务名 `db` 连接 PostgreSQL。

### 4. 构建并启动

在项目根目录执行：

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

配置好域名后通过 `https://你的域名` 访问；如果暂时使用 `DOMAIN=:80`，通过 `http://服务器公网IP` 访问。确认 API 健康接口、登录、学生和教师页面以及实时更新功能正常。

### 5. 更新和数据保护

更新代码后执行 `git pull` 和 `docker compose up -d --build`。普通停止可使用 `docker compose down`；**不要使用 `docker compose down -v`**，它会删除数据库数据卷。定期备份数据库：

```bash
bash scripts/backup_db.sh
```

备份会保存在 `backups/`，该目录不会提交到 Git。还应定期将备份和 `.env` 的安全副本保存到服务器以外的位置。如果要迁移已有 PostgreSQL 数据，需要另行从旧数据库导出并导入；首次启动的 Compose 数据库不会自动包含旧数据。

Docker 发布的端口可能绕过 UFW 规则，因此也要在云服务商安全组中限制公网端口；PostgreSQL 的 5432 和后端的 8000 不应开放到公网。更多信息见 [Docker Compose 生产部署说明](https://docs.docker.com/compose/how-tos/production/)。

## 🔐 默认账号

### 学生账号
- 用户名: 1组 - 8组
- 密码: 12345678

### 教师账号
- 用户名: 蒋佳邑
- 密码: admin123

## 📋 API 文档

### 学生端 API

#### 更新数据记录
```
POST /api/student/update?group_id={group_id}&number={number}&action={action}
```

**参数**:
- `group_id` (int): 登录学生所属组的ID；后端会验证其与账号绑定的小组一致
- `number` (int): 点数 (2-12)
- `action` (str): "increment" 或 "decrement"

每组所有点数的计数总和最多为20。请求还必须携带登录接口返回的 JWT：
`Authorization: Bearer <access_token>`。学生只能操作自己所属组的数据。

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
  "group_name": "1组",
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

重置接口同样要求学生登录，并且只能重置账号所属组的数据。

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

登录成功后，受保护的学生和教师接口都需要在请求头中携带返回的 JWT：
`Authorization: Bearer <access_token>`。学生接口只允许学生角色访问，教师接口只允许教师角色访问。

**请求体**:
```json
{
  "username": "1组",
  "password": "12345678"
}
```

**响应**:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user_id": 1,
  "username": "1组",
  "role": "student"
}
```

## 📊 数据模型

### 用户表 (users)
- id: 主键
- username: 用户名（唯一）
- password: 密码哈希
- role: 角色 ("teacher" 或 "student")
- group_id: 组ID外键

### 组表 (groups)
- id: 主键
- name: 组名 (1组-8组)
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
- 20次上限按小组所有点数的计数总和计算
- -1按钮：减少计数（计数为0时禁用）
- 实时显示当前计数和上限

### 2. 可视化图表
- 柱状图展示各点数的计数分布
- A组(2、3、4、10、11、12): 黄色 (#FFE600)
- B组(5、6、7、8、9): 红色 (#D92121)
- 每个柱子顶部实时显示计数值

### 3. 统计信息
- A组总计: 2、3、4、10、11、12的计数之和
- B组总计: 5、6、7、8、9的计数之和
- 实时显示获胜组别(A/B/平局)

### 4. 实时更新
- 后端在数据变更后通过 Socket.IO 广播受影响的小组
- 学生端和教师端收到通知后重新获取相关数据

## 🚀 下一步开发计划

- [x] Socket.IO实时数据变更通知
- [x] 教师端班级监控面板
- [x] 大数据模拟器
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
