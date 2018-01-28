# now-cli
Command line utility built on node to pull from and push code to a service-now instance

## Installing

Create a file *development.json* in /config
```js
{
  "instance": "<instance_name>",

  "<instance_name_1>": {
    "creds": {
      "user": "<user>",
      "passwd": "<password>"
    },
    "root_src_dir": "<local_root_dir_1>"
  },
  "<instance_name_2>": {
    "creds": {
      "user": "<user>",
      "passwd": "<password>"
    },
    "root_src_dir": "<local_root_dir_2>"
  }
}
```
