from fastapi import FastAPI
from .routers import {{routersImport}}

app = FastAPI(title="{{projectName}}")

{{routerInits}}
