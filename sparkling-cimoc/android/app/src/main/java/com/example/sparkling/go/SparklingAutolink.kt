package com.example.sparkling.go

data class SparklingAutolinkModule(
    val name: String,
    val androidPackage: String?,
    val className: String?,
    val methodClassNames: List<String> = emptyList(),
)

object SparklingAutolink {
    val modules =
        listOf(
            SparklingAutolinkModule(
                name = "sparkling-navigation",
                androidPackage = "com.tiktok.sparkling.method.router",
                className = "RouterMethod",
                methodClassNames =
                    listOf(
                        "com.tiktok.sparkling.method.router.open.RouterOpenMethod",
                        "com.tiktok.sparkling.method.router.close.RouterCloseMethod",
                    ),
            ),
            SparklingAutolinkModule(
                name = "sparkling-cimoc-bridge",
                androidPackage = "com.tiktok.sparkling.methods.cimoc",
                className = "CimocMethod",
                methodClassNames =
                    listOf(
                        "com.tiktok.sparkling.methods.cimoc.getText.CimocGetTextMethod",
                        "com.tiktok.sparkling.methods.cimoc.getBytes.CimocGetBytesMethod",
                        "com.tiktok.sparkling.methods.cimoc.isNetworkAvailable.CimocIsNetworkAvailableMethod",
                        "com.tiktok.sparkling.methods.cimoc.setValue.CimocSetValueMethod",
                        "com.tiktok.sparkling.methods.cimoc.getValue.CimocGetValueMethod",
                        "com.tiktok.sparkling.methods.cimoc.removeValue.CimocRemoveValueMethod",
                        "com.tiktok.sparkling.methods.cimoc.listKeys.CimocListKeysMethod",
                        "com.tiktok.sparkling.methods.cimoc.downloadChapter.CimocDownloadChapterMethod",
                        "com.tiktok.sparkling.methods.cimoc.listDownloadedChapters.CimocListDownloadedChaptersMethod",
                        "com.tiktok.sparkling.methods.cimoc.deleteComicDownload.CimocDeleteComicDownloadMethod",
                        "com.tiktok.sparkling.methods.cimoc.getDownloadDir.CimocGetDownloadDirMethod",
                        "com.tiktok.sparkling.methods.cimoc.scanLocalComics.CimocScanLocalComicsMethod",
                        "com.tiktok.sparkling.methods.cimoc.listLocalChapters.CimocListLocalChaptersMethod",
                        "com.tiktok.sparkling.methods.cimoc.pickFolder.CimocPickFolderMethod",
                        "com.tiktok.sparkling.methods.cimoc.webdavPutFile.CimocWebdavPutFileMethod",
                        "com.tiktok.sparkling.methods.cimoc.webdavGetFile.CimocWebdavGetFileMethod",
                    ),
            ),
        )
}
