#!/usr/bin/env python3
"""直接 psycopg2 连接测试"""

import psycopg2

print("=" * 70)
print("PostgreSQL 连接测试")
print("=" * 70)

# 连接参数
try:
    print("\n正在尝试连接...")
    print("  用户: postgres")
    print("  密码: 123456")
    print("  主机: localhost")
    print("  端口: 5432")
    print()
    
    conn = psycopg2.connect(
        host="localhost",
        port="5432",
        database="postgres",
        user="postgres",
        password="123456"
    )
    
    print("✓ 连接成功！")
    print()
    
    # 查询版本
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()[0]
    
    print("PostgreSQL 版本信息:")
    print(f"  {version}")
    print()
    
    cursor.close()
    conn.close()
    
    print("=" * 70)
    print("✅ 数据库验证通过！")
    print("=" * 70)
    
except psycopg2.OperationalError as e:
    print(f"✗ 连接失败！")
    print(f"\n错误: {e}")
    print("\n🔍 诊断建议:")
    
    if "Connection refused" in str(e):
        print("  - PostgreSQL 服务未启动或监听地址错误")
        print("  - 请确保 PostgreSQL 服务已启动")
        
    elif "authentication failed" in str(e) or "password" in str(e):
        print("  - 用户名或密码错误")
        print("  - 请检查 postgres 用户的密码是否为 123456")
        
    elif "does not exist" in str(e):
        print("  - 用户或数据库不存在")
        
    else:
        print("  - 其他连接问题")
        
except Exception as e:
    print(f"✗ 错误: {e}")
