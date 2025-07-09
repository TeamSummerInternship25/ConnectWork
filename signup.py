import logging
users = {}
def register_user(username, password):
if username in users:
return False
users[username] = password
return True
if __name__ == "__main__":
user, pwd = input("Choose username: "), input("Choose password: ")
if register_user(user, pwd):
logging.info("User %s registered", user)
print("Registration successful.")
else:
logging.warning("Registration failed: %s already exists", user)
print("Username already taken.")
