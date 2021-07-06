Build: 

    docker build . -t websocketsserver

Example:

    docker run -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock -e WEBAPIKEY=xxx websocketsserver


Deploy:

    #local:
    git archive main --output deploy.zip 
    pscp deploy.zip eouser@eo-stack:/home/eouser/

    #remote:
    unzip deploy.zip -d websocketsserver
    docker build websocketsserver --network host
