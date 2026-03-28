#!/usr/bin/env python3
"""快速数据库连接测试脚本"""

import sys

print("=" * 60)
print("数据库连接测试")
print("=" * 60)

# 测试 SQLAlchemy 导入
try:
    from sqlalchemy import create_engine, text
    print("✓ SQLAlchemy 已安装")
except ImportError as e:
    print(f"✗ SQLAlchemy 导入失败: {e}")
    sys.exit(1)

# 测试 psycopg2 导入
try:
    import psycopg2
    print("✓ psycopg2 已安装")
except ImportError as e:
    print(f"✗ psycopg2 导入失败: {e}")
    sys.exit(1)

print("\n测试数据库连接...")
print("-" * 60)

# PostgreSQL 连接参数
DB_PARAMS = {
    "user": "postgres",
    "password": "123456",
    "host": "localhost",
    "port": "5432",
    "database": "postgres"  # 先连接默认数据库
}

# 创建连接字符串
db_url = f"postgresql://{DB_PARAMS['user']}:{DB_PARAMS['password']}@{DB_PARAMS['host']}:{DB_PARAMS['port']}/{DB_PARAMS['database']}"

print(f"连接字符串: postgresql://postgres:***@localhost:5432/postgres")
print()

try:
    engine = create_engine(db_url, echo=False)
    
    # 尝试连接
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        version = result.fetchone()[0]
        print("✓ 数据库连接成功！")
        print(f"\nPostgreSQL 版本信息:")
        print(f"  {version}")
        
except Exception as e:
    print(f"✗ 数据库连接失败!")
    print(f"\n错误信息: {e}")
    print(f"\n可能的原因:")
    print(f"  1. PostgreSQL 服务未启动")
    print(f"  2. 用户名/密码错误 (当前: postgres / 123456)")
    print(f"  3. 主机/端口错误 (当前: localhost:5432)")
    print(f"\n解决方案:")
    print(f"  1. 确保 PostgreSQL 服务正在运行")
    print(f"  2. 确认 postgres 用户密码为 123456")
    print(f"  3. 如果使用不同的凭证, 修改此脚本")
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ 所有测试通过！可以启动应用")
print("=" * 60)
