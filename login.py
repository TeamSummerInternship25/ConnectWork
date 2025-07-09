import logging

def validate_credentials(username, password):
    # 简单示例，生产环境请勿明文存储密码
    return username == "admin" and password == "password123"

if __name__ == "__main__":
    user, pwd = input("Username: "), input("Password: ")
    if validate_credentials(user, pwd):
        logging.info("Login successful for %s", user)
        print("Welcome, {}!".format(user))
    else:
        logging.error("Login failed for %s", user)
        print("Invalid credentials.")
