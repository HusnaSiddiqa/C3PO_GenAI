SAVE_LARGE_CSV_TO_S3 = '''
INSERT OVERWRITE DIRECTORY 's3a://{bucket}/{path}/'
USING CSV
OPTIONS (header = "true")
'''
