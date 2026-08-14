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
                name = "sparkling-cimoc-bridge",
                androidPackage = "com.tiktok.sparkling.methods.cimoc",
                className = "CimocMethod",
                methodClassNames =
                    listOf(
                        "com.tiktok.sparkling.methods.cimoc.getText.CimocGetTextMethod",
                        "com.tiktok.sparkling.methods.cimoc.downloadChapter.CimocDownloadChapterMethod",
                        "com.tiktok.sparkling.methods.cimoc.listDownloadedChapters.CimocListDownloadedChaptersMethod",
                        "com.tiktok.sparkling.methods.cimoc.scanLocalComics.CimocScanLocalComicsMethod",
                        "com.tiktok.sparkling.methods.cimoc.pickFolder.CimocPickFolderMethod",
                        "com.tiktok.sparkling.methods.cimoc.webdavPutFile.CimocWebdavPutFileMethod",
                        "com.tiktok.sparkling.methods.cimoc.webdavGetFile.CimocWebdavGetFileMethod",
                        "com.tiktok.sparkling.methods.cimoc.rustVersion.CimocRustVersionMethod",
                    ),
            ),
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
                name = "sparkling-storage",
                androidPackage = "com.tiktok.sparkling.method.storage",
                className = "StorageMethod",
                methodClassNames =
                    listOf(
                        "com.tiktok.sparkling.method.storage.getItem.StorageGetItemMethod",
                        "com.tiktok.sparkling.method.storage.setItem.StorageSetItemMethod",
                        "com.tiktok.sparkling.method.storage.removeItem.StorageRemoveItemMethod",
                    ),
            ),
        )
}
