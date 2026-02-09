SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `tokimori` DEFAULT CHARACTER SET utf8mb4 ;
USE `mydb` ;

-- -----------------------------------------------------
-- Table `mydb`.`games`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`games` (
  `idGames` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `img` VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`idGames`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;

-- -----------------------------------------------------
-- Table `mydb`.`users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`users` (
  `idUsers` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`idUsers`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;

-- -----------------------------------------------------
-- Table `mydb`.`library`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`library` (
  `idLibrary` INT NOT NULL AUTO_INCREMENT,
  `Users_idUsers` INT NOT NULL,
  `Games_idGames` INT NOT NULL,
  `totalHours` DECIMAL(10,2) NULL DEFAULT '0.00',
  PRIMARY KEY (`idLibrary`),
  CONSTRAINT `fk_Biblioteca_Games`
    FOREIGN KEY (`Games_idGames`)
    REFERENCES `mydb`.`games` (`idGames`)
    ON DELETE RESTRICT,
  CONSTRAINT `fk_Biblioteca_Users`
    FOREIGN KEY (`Users_idUsers`)
    REFERENCES `mydb`.`users` (`idUsers`)
    ON DELETE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;

CREATE UNIQUE INDEX `unique_juego_usuario` ON `mydb`.`library` (`Users_idUsers` ASC, `Games_idGames` ASC) VISIBLE;
CREATE INDEX `fk_Biblioteca_Games` ON `mydb`.`library` (`Games_idGames` ASC) VISIBLE;

-- -----------------------------------------------------
-- Table `mydb`.`sessions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`sessions` (
  `idSessions` INT NOT NULL AUTO_INCREMENT,
  `Library_idLibrary` INT NOT NULL,
  `date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `minutes` INT NULL DEFAULT 0,
  PRIMARY KEY (`idSessions`),
  CONSTRAINT `fk_Sessions_Biblioteca`
    FOREIGN KEY (`Library_idLibrary`)
    REFERENCES `mydb`.`library` (`idLibrary`)
    ON DELETE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;

CREATE INDEX `fk_Sessions_Biblioteca` ON `mydb`.`sessions` (`Library_idLibrary` ASC) VISIBLE;

-- -----------------------------------------------------
-- Table `mydb`.`objectives`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`objectives` (
  `idObjectives` INT NOT NULL AUTO_INCREMENT, -- AÑADIDO AUTO_INCREMENT
  `library_idLibrary` INT NOT NULL,
  `title` VARCHAR(255) NULL,
  `colour` VARCHAR(255) NULL,
  `number` INT NULL,
  PRIMARY KEY (`idObjectives`),
  CONSTRAINT `fk_objectives_library1`
    FOREIGN KEY (`library_idLibrary`)
    REFERENCES `mydb`.`library` (`idLibrary`)
    ON DELETE CASCADE -- AÑADIDO CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;

CREATE INDEX `fk_objectives_library1_idx` ON `mydb`.`objectives` (`library_idLibrary` ASC) VISIBLE;

-- -----------------------------------------------------
-- Table `mydb`.`tasks`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`tasks` (
  `idTask` INT NOT NULL AUTO_INCREMENT, -- AÑADIDO AUTO_INCREMENT
  `objectives_idObjectives` INT NOT NULL,
  `completed` TINYINT(1) NULL DEFAULT 0,
  `title` VARCHAR(255) NULL,
  PRIMARY KEY (`idTask`),
  CONSTRAINT `fk_Task_objectives1`
    FOREIGN KEY (`objectives_idObjectives`)
    REFERENCES `mydb`.`objectives` (`idObjectives`)
    ON DELETE CASCADE -- AÑADIDO CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;

CREATE INDEX `fk_Task_objectives1_idx` ON `mydb`.`tasks` (`objectives_idObjectives` ASC) VISIBLE; -- Faltaba el índice visible

-- -----------------------------------------------------
-- Table `mydb`.`notes`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`notes` (
  `idNotes` INT NOT NULL AUTO_INCREMENT, -- AÑADIDO AUTO_INCREMENT
  `library_idLibrary` INT NOT NULL,
  `title` VARCHAR(255) NULL,
  `text` MEDIUMTEXT NULL,
  `colour` VARCHAR(255) NULL,
  PRIMARY KEY (`idNotes`),
  CONSTRAINT `fk_notes_library1`
    FOREIGN KEY (`library_idLibrary`)
    REFERENCES `mydb`.`library` (`idLibrary`)
    ON DELETE CASCADE -- AÑADIDO CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;

CREATE INDEX `fk_notes_library1_idx` ON `mydb`.`notes` (`library_idLibrary` ASC) VISIBLE;

-- -----------------------------------------------------
-- Table `mydb`.`canvas`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`canvas` (
  `idcanvas` INT NOT NULL AUTO_INCREMENT, -- AÑADIDO AUTO_INCREMENT
  `library_idLibrary` INT NOT NULL,
  `title` VARCHAR(255) NULL,
  `contenido` LONGTEXT NULL, -- JSON del dibujo va aquí
  PRIMARY KEY (`idcanvas`),
  CONSTRAINT `fk_canvas_library1`
    FOREIGN KEY (`library_idLibrary`)
    REFERENCES `mydb`.`library` (`idLibrary`)
    ON DELETE CASCADE -- AÑADIDO CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;

CREATE INDEX `fk_canvas_library1_idx` ON `mydb`.`canvas` (`library_idLibrary` ASC) VISIBLE;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;