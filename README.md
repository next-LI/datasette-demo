# NextLI's Live Datasette Demo

Hello! This is all the configuration and deploy/infrastructure stuff driving the NextLI Datasette live demo.

Right now it's live at [datasette-live.bxroberts.org](https://datasette-live.bxroberts.org)

This environment bundles the following plugins, The following plugins were built by Newsdays's NextLI team as part of a GNI Innovation Challenge:

- [datasette-csv-importer](https://github.com/next-LI/datasette-csv-importer.git)
- [datasette-live-permissions](https://github.com/next-LI/datasette-live-permissions.git)
- [datasette-live-config](https://github.com/next-LI/datasette-live-config.git)
- [datasette-surveys](https://github.com/next-LI/datasette-surveys.git)
- [datasette-search-all](https://github.com/next-LI/datasette-search-all.git) (we only modified this one)

In addition to these core plugins, we've also included these plugins which provide mapping, charting and other misc functionality: `datasette install datasette-auth-github datasette-leaflet datasette-leaflet-geojson datasette-leaflet-freedraw datasette-export-notebook datasette-configure-fts datasette-render-images datasette-vega datasette-show-errors datasette-saved-queries`

## Deploying

This setup assumed you have a VM running somewhere and your current user has SSH access, via shared key (e.g., `ssh -i ~/.ssh/id_rsa user@vm`. We're using `gcloud` for everything here and assume so moving forward. If you set your remote VM so your local user is the same name as your remote user w/ sudo access, things will work most smoothly.

I wrote a convenience method for SSHing into your instance using `gcloud` if you haven't setup old school SSH access yet. I've wrapped it in a make command:

    make gcloud_ssh DEMO_VM_NAME=your_vm_name DEMO_PROJECT_ID=your-gcp-project-id

It's suggested to setup SSH by taking your `${HOME}/.ssh/id_rsa.pub` and adding it to the remote user's `${HOME}/.ssh/authorized_keys` then you'll be able to SSH in without using a password or prompt.

You can test your setup by running:

    make ssh

If you get a remote shell, everything is set up properly.

Once ready, you can deploy this Datasette environment by running:

    make deploy

NOTE: You can override any of the variables in the `Makefile` by appending them to the make call:

    make deploy SUDO_USER=brandon

The `deploy.sh` runs all the commands on the remote to setup Datasette, nginx and all the plugins.

## Configuration and Permissions 

Permissions are bootstrapped using the `plugins/permissions.py` mini-plugin (so you can sign in with GitHub and have access). You should add your email to the access list.

Once everything is set up and running, permissions should be and managed with the [datasette-live-permissions](https://github.com/next-LI/datasette-live-permissions.git) plugin.

Configuration is managed using the [datasette-live-config](https://github.com/next-LI/datasette-live-config.git) plugin. You can dynamically change all config here, once you've granted yourself the `live-config` permission. By default, this plugin will ready anything set in the `config/metadata.yml` file. As a security precaution, __you cannot change the config in this file__. The suggested workflow for settings is the following: fill your `config/metadata.yml` with all your configuration. Then deploy your instance and go to the  `/-/live-config` interface. Make any changes you want and click save. Then remove everything from your local `config/metadata.yml` file that you want to be able to change and re-deploy. Then your secure settings will be protected, but you'll be able to change anything else.
