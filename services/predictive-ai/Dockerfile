FROM python:3.12-slim

WORKDIR /workspace/services/predictive-ai

COPY services/predictive-ai/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# O bundle .joblib não é versionado. Preservamos a estrutura do monorepo
# porque os scripts resolvem datasets a partir da raiz do repositório.
COPY services/predictive-ai /workspace/services/predictive-ai
COPY datasets/processed /workspace/datasets/processed
COPY datasets/demo /workspace/datasets/demo
COPY datasets/metadata /workspace/datasets/metadata
COPY datasets/reports /workspace/datasets/reports

# Build fail-closed: uma imagem nunca é publicada sem gerar e validar o
# artefato térmico real e seus metadados/checksum.
RUN python -m training.train_thermal_models \
    && python -m training.validate_model_artifact

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
